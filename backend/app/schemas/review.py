"""DTO режима повторения: карточки, оценки, конспекты теории."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class CardOut(BaseModel):
    """Карточка для показа в режиме повторения."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    block_slug: str
    note_title: str | None
    question_md: str
    answer_md: str
    # Сколько раз подряд карточку вспоминали — помогает понять, новая она или знакомая.
    repetitions: int = 0
    due_date: date | None = None


class GradeIn(BaseModel):
    """Оценка самопроверки: 0 забыл, 3 с трудом, 5 легко."""

    grade: int = Field(ge=0, le=5)


class ReviewStateOut(BaseModel):
    """Состояние карточки после оценки — фронт показывает, когда она вернётся."""

    model_config = ConfigDict(from_attributes=True)

    ease_factor: float
    interval_days: int
    repetitions: int
    due_date: date


class ReviewSummaryOut(BaseModel):
    """Сводка для дашборда и шапки."""

    due_today: int
    cards_total: int


class NoteListItemOut(BaseModel):
    """Конспект в списке теории."""

    slug: str
    block_slug: str
    title: str
    tags: list[str]
    cards_count: int


class NoteDetailOut(NoteListItemOut):
    """Полный конспект."""

    body_md: str
