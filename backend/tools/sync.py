"""Заливка контента из content/ в PostgreSQL.

Upsert идёт по slug. Объект, пропавший из файлов, не удаляется физически, а помечается
`is_archived = true`: иначе вместе с ним каскадом улетела бы персональная история попыток и
повторений. Персональные таблицы sync не трогает вообще.
"""

import argparse
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Block, Card, Dataset, Task, TheoryNote, Topic
from app.db.session import SessionLocal
from tools.loader import ContentBundle, load_content
from tools.parse import ContentError


def _sync_blocks(db: Session, bundle: ContentBundle) -> dict[str, Block]:
    """Создаёт или обновляет блоки и их темы. Возвращает блоки по слагу."""
    existing = {block.slug: block for block in db.scalars(select(Block))}
    seen: set[str] = set()

    for order, config in enumerate(bundle.blocks.blocks):
        block = existing.get(config.slug)
        if block is None:
            block = Block(slug=config.slug)
            db.add(block)
        block.title = config.title
        block.description = config.description
        block.icon = config.icon
        block.sort_order = order
        block.is_archived = False
        seen.add(config.slug)
        db.flush()

        existing_topics = {
            topic.slug: topic
            for topic in db.scalars(select(Topic).where(Topic.block_id == block.id))
        }
        seen_topics: set[str] = set()
        for topic_order, topic_config in enumerate(config.topics):
            topic = existing_topics.get(topic_config.slug)
            if topic is None:
                topic = Topic(block_id=block.id, slug=topic_config.slug)
                db.add(topic)
            topic.title = topic_config.title
            topic.sort_order = topic_order
            topic.is_archived = False
            seen_topics.add(topic_config.slug)
        for slug, topic in existing_topics.items():
            if slug not in seen_topics:
                topic.is_archived = True

    for slug, block in existing.items():
        if slug not in seen:
            block.is_archived = True

    db.flush()
    return {block.slug: block for block in db.scalars(select(Block))}


def _sync_datasets(db: Session, bundle: ContentBundle) -> dict[str, Dataset]:
    """Создаёт или обновляет датасеты."""
    existing = {dataset.slug: dataset for dataset in db.scalars(select(Dataset))}
    seen: set[str] = set()

    for parsed in bundle.datasets:
        dataset = existing.get(parsed.slug)
        if dataset is None:
            dataset = Dataset(slug=parsed.slug)
            db.add(dataset)
        dataset.title = parsed.title
        dataset.schema_sql = parsed.schema_sql
        dataset.seed_sql = parsed.seed_sql
        dataset.er_description = parsed.er_description
        dataset.content_hash = parsed.content_hash
        dataset.is_archived = False
        seen.add(parsed.slug)

    for slug, dataset in existing.items():
        if slug not in seen:
            dataset.is_archived = True

    db.flush()
    return {dataset.slug: dataset for dataset in db.scalars(select(Dataset))}


def _topic_id(db: Session, block: Block, topic_slug: str | None) -> int | None:
    """Идентификатор темы внутри блока по её слагу."""
    if not topic_slug:
        return None
    stmt = select(Topic.id).where(Topic.block_id == block.id, Topic.slug == topic_slug)
    return db.scalars(stmt).first()


def _sync_tasks(
    db: Session, bundle: ContentBundle, blocks: dict[str, Block], datasets: dict[str, Dataset]
) -> int:
    """Создаёт или обновляет задачи. Возвращает число активных задач."""
    existing = {task.slug: task for task in db.scalars(select(Task))}
    seen: set[str] = set()

    for parsed in bundle.tasks:
        block = blocks[parsed.meta.block]
        task = existing.get(parsed.slug)
        if task is None:
            task = Task(slug=parsed.slug)
            db.add(task)

        task.block_id = block.id
        task.topic_id = _topic_id(db, block, parsed.meta.topic)
        task.dataset_id = datasets[parsed.meta.dataset].id if parsed.meta.dataset else None
        task.title = parsed.meta.title
        task.difficulty = parsed.meta.difficulty
        task.tags = list(parsed.meta.tags)
        task.source = parsed.meta.source
        task.company = parsed.meta.company
        task.estimated_minutes = parsed.meta.estimated_minutes
        task.statement_md = parsed.statement_md
        task.solution_md = parsed.solution_md
        task.explanation_md = parsed.explanation_md
        task.solution_sql = parsed.solution_sql
        task.check_config = parsed.meta.check.model_dump()
        task.position = parsed.position
        task.content_hash = parsed.content_hash
        task.is_archived = False
        seen.add(parsed.slug)

    for slug, task in existing.items():
        if slug not in seen:
            task.is_archived = True

    db.flush()
    return len(seen)


def _sync_notes(db: Session, bundle: ContentBundle, blocks: dict[str, Block]) -> tuple[int, int]:
    """Создаёт или обновляет конспекты и их карточки. Возвращает (конспектов, карточек)."""
    existing_notes = {note.slug: note for note in db.scalars(select(TheoryNote))}
    existing_cards = {card.slug: card for card in db.scalars(select(Card))}
    seen_notes: set[str] = set()
    seen_cards: set[str] = set()

    for parsed in bundle.notes:
        block = blocks[parsed.meta.block]
        note = existing_notes.get(parsed.slug)
        if note is None:
            note = TheoryNote(slug=parsed.slug)
            db.add(note)

        note.block_id = block.id
        note.topic_id = _topic_id(db, block, parsed.meta.topic)
        note.title = parsed.meta.title
        note.body_md = parsed.body_md
        note.tags = list(parsed.meta.tags)
        note.position = parsed.position
        note.content_hash = parsed.content_hash
        note.is_archived = False
        seen_notes.add(parsed.slug)
        db.flush()

        for parsed_card in parsed.cards:
            card = existing_cards.get(parsed_card.slug)
            if card is None:
                card = Card(slug=parsed_card.slug)
                db.add(card)
            card.block_id = block.id
            card.note_id = note.id
            card.question_md = parsed_card.question_md
            card.answer_md = parsed_card.answer_md
            card.position = parsed_card.position
            card.is_archived = False
            seen_cards.add(parsed_card.slug)

    for slug, note in existing_notes.items():
        if slug not in seen_notes:
            note.is_archived = True
    for slug, card in existing_cards.items():
        if slug not in seen_cards:
            card.is_archived = True

    db.flush()
    return len(seen_notes), len(seen_cards)


def sync(content_dir: Path) -> tuple[int, int, int, int]:
    """Заливает контент в БД. Возвращает (задач, конспектов, карточек, датасетов)."""
    bundle, problems = load_content(content_dir)
    if problems:
        raise ContentError(
            content_dir,
            "контент не проходит проверку, sync отменён:\n  • " + "\n  • ".join(problems),
        )

    with SessionLocal() as db:
        blocks = _sync_blocks(db, bundle)
        datasets = _sync_datasets(db, bundle)
        tasks_count = _sync_tasks(db, bundle, blocks, datasets)
        notes_count, cards_count = _sync_notes(db, bundle, blocks)
        db.commit()

    return tasks_count, notes_count, cards_count, len(bundle.datasets)


def main(argv: list[str] | None = None) -> int:
    """Точка входа команды `python -m tools sync`."""
    parser = argparse.ArgumentParser(
        prog="tools sync", description="Залить контент из content/ в PostgreSQL"
    )
    parser.add_argument(
        "--content-dir", type=Path, default=settings.content_dir, help="Каталог с контентом"
    )
    args = parser.parse_args(argv)

    try:
        tasks, notes, cards, datasets = sync(args.content_dir)
    except ContentError as exc:
        print(f"✗ {exc}")
        return 1

    print(
        f"✓ Синхронизировано: {tasks} задач, {notes} конспектов, "
        f"{cards} карточек, {datasets} датасетов"
    )
    return 0
