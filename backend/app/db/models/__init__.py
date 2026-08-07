"""Реэкспорт ORM-моделей: импорт этого пакета регистрирует их в Base.metadata."""

from app.db.models.content import (
    DIFFICULTIES,
    SOURCES,
    Block,
    Card,
    Dataset,
    Task,
    TheoryNote,
    Topic,
)
from app.db.models.personal import (
    GRADE_EASY,
    GRADE_FORGOT,
    GRADE_HARD,
    TASK_STATUSES,
    Attempt,
    NoteProgress,
    ReviewLog,
    ReviewState,
    TaskProgress,
)

__all__ = [
    "DIFFICULTIES",
    "SOURCES",
    "TASK_STATUSES",
    "GRADE_FORGOT",
    "GRADE_HARD",
    "GRADE_EASY",
    "Block",
    "Topic",
    "Dataset",
    "Task",
    "TheoryNote",
    "Card",
    "Attempt",
    "TaskProgress",
    "NoteProgress",
    "ReviewState",
    "ReviewLog",
]
