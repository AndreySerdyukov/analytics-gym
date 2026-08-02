"""Выгрузка контента в JSON для статического демо на GitHub Pages.

Демо работает без бэкенда: контент читается из этого файла, а прогресс и повторения живут
в localStorage браузера. Личные заметки сюда не попадают — они есть только в БД.
"""

import argparse
import json
from pathlib import Path

from app.core.config import settings
from tools.loader import ContentBundle, load_content
from tools.parse import ContentError

DEFAULT_OUTPUT = settings.content_dir.parent / "frontend" / "public" / "content.json"


def build_payload(bundle: ContentBundle) -> dict:
    """Собирает структуру, которую ожидает StaticDataSource на фронте."""
    return {
        "blocks": [
            {
                "slug": block.slug,
                "title": block.title,
                "description": block.description,
                "icon": block.icon,
                "sort_order": order,
                "topics": [
                    {"slug": topic.slug, "title": topic.title, "sort_order": topic_order}
                    for topic_order, topic in enumerate(block.topics)
                ],
            }
            for order, block in enumerate(bundle.blocks.blocks)
        ],
        "datasets": [
            {
                "slug": dataset.slug,
                "title": dataset.title,
                "schema_sql": dataset.schema_sql,
                "seed_sql": dataset.seed_sql,
                "er_description": dataset.er_description,
            }
            for dataset in bundle.datasets
        ],
        "tasks": [
            {
                "slug": task.slug,
                "title": task.meta.title,
                "block_slug": task.meta.block,
                "topic_slug": task.meta.topic,
                "difficulty": task.meta.difficulty,
                "tags": list(task.meta.tags),
                "source": task.meta.source,
                "company": task.meta.company,
                "estimated_minutes": task.meta.estimated_minutes,
                "statement_md": task.statement_md,
                "solution_md": task.solution_md,
                "explanation_md": task.explanation_md,
                "solution_sql": task.solution_sql,
                "check_config": task.meta.check.model_dump(),
                "dataset_slug": task.meta.dataset,
                "position": task.position,
            }
            for task in bundle.tasks
        ],
        "notes": [
            {
                "slug": note.slug,
                "title": note.meta.title,
                "block_slug": note.meta.block,
                "topic_slug": note.meta.topic,
                "tags": list(note.meta.tags),
                "body_md": note.body_md,
                "position": note.position,
            }
            for note in bundle.notes
        ],
        "cards": [
            {
                "slug": card.slug,
                "block_slug": note.meta.block,
                "note_slug": note.slug,
                "question_md": card.question_md,
                "answer_md": card.answer_md,
                "position": card.position,
            }
            for note in bundle.notes
            for card in note.cards
        ],
    }


def main(argv: list[str] | None = None) -> int:
    """Точка входа команды `python -m tools export-static`."""
    parser = argparse.ArgumentParser(
        prog="tools export-static", description="Выгрузить контент в JSON для демо-билда"
    )
    parser.add_argument(
        "--content-dir", type=Path, default=settings.content_dir, help="Каталог с контентом"
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Куда писать JSON")
    args = parser.parse_args(argv)

    try:
        bundle, problems = load_content(args.content_dir)
    except ContentError as exc:
        print(f"✗ {exc}")
        return 1

    if problems:
        print(f"✗ Контент не проходит проверку ({len(problems)}), экспорт отменён:")
        for problem in problems:
            print(f"  • {problem}")
        return 1

    payload = build_payload(bundle)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    size_kb = args.output.stat().st_size / 1024
    print(f"✓ {args.output} ({size_kb:.0f} КБ, {len(payload['tasks'])} задач)")
    return 0
