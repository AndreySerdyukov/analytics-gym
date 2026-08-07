"""Бизнес-логика блоков и задач: склейка контента с персональным прогрессом.

Модуль не импортирует FastAPI — его можно тестировать изолированно.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import TASK_STATUSES, Task, TaskProgress
from app.repositories import content as content_repo
from app.repositories import personal as personal_repo
from app.schemas.content import BlockOut, DatasetOut, TaskDetailOut, TaskListItemOut, TopicOut
from app.schemas.personal import AttemptIn, AttemptOut, ProgressOut
from app.services import progress as progress_rules
from app.services.errors import NotFoundError, ValidationError


def _to_list_item(
    task: Task, topic_slug: str | None, progress: TaskProgress | None, block_slug: str
) -> TaskListItemOut:
    """Строит DTO строки списка из задачи и её прогресса."""
    return TaskListItemOut(
        slug=task.slug,
        title=task.title,
        block_slug=block_slug,
        topic_slug=topic_slug,
        difficulty=task.difficulty,
        tags=list(task.tags or []),
        source=task.source,
        company=task.company,
        estimated_minutes=task.estimated_minutes,
        status=progress.status if progress else "new",
        attempts_count=progress.attempts_count if progress else 0,
    )


def list_blocks(db: Session) -> list[BlockOut]:
    """Блоки со сводкой по практике и теории для дашборда и хаба блока."""
    counts = content_repo.block_task_counts(db)
    note_counts = content_repo.block_note_counts(db)
    blocks: list[BlockOut] = []
    for block in content_repo.list_blocks(db):
        total, solved = counts.get(block.slug, (0, 0))
        notes_total, notes_read = note_counts.get(block.slug, (0, 0))
        topics = [
            TopicOut.model_validate(topic)
            for topic in sorted(block.topics, key=lambda t: (t.sort_order, t.slug))
            if not topic.is_archived
        ]
        blocks.append(
            BlockOut(
                slug=block.slug,
                title=block.title,
                description=block.description,
                icon=block.icon,
                sort_order=block.sort_order,
                topics=topics,
                tasks_total=total,
                tasks_solved=solved,
                notes_total=notes_total,
                notes_read=notes_read,
            )
        )
    return blocks


def list_tasks(
    db: Session,
    *,
    block_slug: str | None = None,
    difficulty: str | None = None,
    tags: list[str] | None = None,
    status: str | None = None,
    company: str | None = None,
    search: str | None = None,
) -> list[TaskListItemOut]:
    """Отфильтрованный список задач."""
    if status is not None and status not in TASK_STATUSES:
        raise ValidationError(f"Неизвестный статус: {status}")
    if block_slug and content_repo.get_block_by_slug(db, block_slug) is None:
        raise NotFoundError(f"Блок не найден: {block_slug}")

    rows = content_repo.list_tasks(
        db,
        block_slug=block_slug,
        difficulty=difficulty,
        tags=tags,
        status=status,
        company=company,
        search=search,
    )
    return [
        _to_list_item(task, topic_slug, progress, block_slug_)
        for task, block_slug_, topic_slug, progress in rows
    ]


def get_task(db: Session, slug: str) -> TaskDetailOut:
    """Полная задача с датасетом, прогрессом и личной заметкой."""
    row = content_repo.get_task_by_slug(db, slug)
    if row is None:
        raise NotFoundError(f"Задача не найдена: {slug}")
    task, block_slug_, topic_slug, progress = row

    dataset = None
    if task.dataset_id is not None:
        dataset_model = content_repo.get_dataset(db, task.dataset_id)
        if dataset_model is not None:
            dataset = DatasetOut.model_validate(dataset_model)

    base = _to_list_item(task, topic_slug, progress, block_slug_)
    return TaskDetailOut(
        **base.model_dump(),
        statement_md=task.statement_md,
        solution_md=task.solution_md,
        explanation_md=task.explanation_md,
        solution_sql=task.solution_sql,
        check_config=task.check_config or {},
        dataset=dataset,
        personal_note_md=progress.personal_note_md if progress else None,
    )


def record_attempt(db: Session, slug: str, payload: AttemptIn) -> tuple[AttemptOut, ProgressOut]:
    """Сохраняет попытку и пересчитывает статус задачи."""
    row = content_repo.get_task_by_slug(db, slug)
    if row is None:
        raise NotFoundError(f"Задача не найдена: {slug}")
    task, _, _, _ = row

    attempt = personal_repo.create_attempt(
        db,
        task_id=task.id,
        submitted_code=payload.submitted_code,
        is_correct=payload.is_correct,
        duration_seconds=payload.duration_seconds,
        error_text=payload.error_text,
    )

    now = datetime.now(UTC)
    current = personal_repo.get_or_create_progress(db, task.id)
    progress = personal_repo.save_progress(
        db,
        task_id=task.id,
        status=progress_rules.next_status(current.status, payload.is_correct),
        attempts_count=current.attempts_count + 1,
        first_solved_at=progress_rules.first_solved_at(
            current.first_solved_at, payload.is_correct, now
        ),
        last_attempt_at=now,
    )
    db.commit()
    return AttemptOut.model_validate(attempt), ProgressOut.model_validate(progress)


def save_note(db: Session, slug: str, note_md: str | None) -> ProgressOut:
    """Сохраняет личную заметку к задаче."""
    row = content_repo.get_task_by_slug(db, slug)
    if row is None:
        raise NotFoundError(f"Задача не найдена: {slug}")
    task, _, _, _ = row

    progress = personal_repo.set_note(db, task_id=task.id, note_md=note_md)
    db.commit()
    return ProgressOut.model_validate(progress)


def set_status(db: Session, slug: str, status: str) -> ProgressOut:
    """Ручная смена статуса задачи."""
    if status not in TASK_STATUSES:
        raise ValidationError(f"Неизвестный статус: {status}")
    row = content_repo.get_task_by_slug(db, slug)
    if row is None:
        raise NotFoundError(f"Задача не найдена: {slug}")
    task, _, _, _ = row

    progress = personal_repo.set_status(db, task_id=task.id, status=status)
    db.commit()
    return ProgressOut.model_validate(progress)
