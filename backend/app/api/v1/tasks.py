"""Роутер задач: список с фильтрами, карточка задачи, попытки, заметки, статус."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.content import TaskDetailOut, TaskListItemOut
from app.schemas.personal import AttemptIn, NoteIn, ProgressOut, StatusIn
from app.services import tasks as tasks_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskListItemOut])
def list_tasks(
    block: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    tag: list[str] | None = Query(default=None, description="Повторяемый параметр: ?tag=a&tag=b"),
    status: str | None = Query(default=None),
    company: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[TaskListItemOut]:
    """Список задач с фильтрами по блоку, сложности, тегам, статусу, компании и поиском."""
    return tasks_service.list_tasks(
        db,
        block_slug=block,
        difficulty=difficulty,
        tags=tag,
        status=status,
        company=company,
        search=search,
    )


@router.get("/{slug}", response_model=TaskDetailOut)
def get_task(slug: str, db: Session = Depends(get_db)) -> TaskDetailOut:
    """Полная задача: условие, решение, разбор, датасет, прогресс и заметка."""
    return tasks_service.get_task(db, slug)


@router.post("/{slug}/attempts", response_model=dict)
def create_attempt(slug: str, payload: AttemptIn, db: Session = Depends(get_db)) -> dict:
    """Записывает попытку (проверка выполнена в браузере) и возвращает новый прогресс."""
    attempt, progress = tasks_service.record_attempt(db, slug, payload)
    return {"attempt": attempt, "progress": progress}


@router.put("/{slug}/note", response_model=ProgressOut)
def save_note(slug: str, payload: NoteIn, db: Session = Depends(get_db)) -> ProgressOut:
    """Сохраняет личную заметку к задаче."""
    return tasks_service.save_note(db, slug, payload.personal_note_md)


@router.put("/{slug}/status", response_model=ProgressOut)
def set_status(slug: str, payload: StatusIn, db: Session = Depends(get_db)) -> ProgressOut:
    """Ручная смена статуса задачи."""
    return tasks_service.set_status(db, slug, payload.status)
