"""Доступ к персональным таблицам: попытки, прогресс, заметки. Весь SQL — здесь."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Attempt, TaskProgress


def create_attempt(
    db: Session,
    *,
    task_id: int,
    submitted_code: str,
    is_correct: bool,
    duration_seconds: int | None,
    error_text: str | None,
) -> Attempt:
    """Записывает попытку решения."""
    attempt = Attempt(
        task_id=task_id,
        submitted_code=submitted_code,
        is_correct=is_correct,
        duration_seconds=duration_seconds,
        error_text=error_text,
    )
    db.add(attempt)
    db.flush()
    return attempt


def get_progress(db: Session, task_id: int) -> TaskProgress | None:
    """Прогресс по задаче или None, если задачу ещё не открывали."""
    stmt = select(TaskProgress).where(TaskProgress.task_id == task_id)
    return db.scalars(stmt).first()


def get_or_create_progress(db: Session, task_id: int) -> TaskProgress:
    """Прогресс по задаче, создавая пустую запись при первом обращении."""
    progress = get_progress(db, task_id)
    if progress is None:
        progress = TaskProgress(task_id=task_id, status="new", attempts_count=0)
        db.add(progress)
        db.flush()
    return progress


def save_progress(
    db: Session,
    *,
    task_id: int,
    status: str,
    attempts_count: int,
    first_solved_at: datetime | None,
    last_attempt_at: datetime,
) -> TaskProgress:
    """Записывает пересчитанное состояние прогресса. Решение о значениях принимает services."""
    progress = get_or_create_progress(db, task_id)
    progress.status = status
    progress.attempts_count = attempts_count
    progress.first_solved_at = first_solved_at
    progress.last_attempt_at = last_attempt_at
    db.flush()
    return progress


def set_note(db: Session, *, task_id: int, note_md: str | None) -> TaskProgress:
    """Сохраняет личную заметку к задаче."""
    progress = get_or_create_progress(db, task_id)
    progress.personal_note_md = note_md
    db.flush()
    return progress


def set_status(db: Session, *, task_id: int, status: str) -> TaskProgress:
    """Ручная смена статуса задачи (например, отметить «сдался»)."""
    progress = get_or_create_progress(db, task_id)
    progress.status = status
    db.flush()
    return progress
