"""DTO персональной части: попытки, прогресс, заметки."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AttemptIn(BaseModel):
    """Попытка решения, присланная фронтом после проверки в браузере."""

    submitted_code: str
    is_correct: bool
    duration_seconds: int | None = Field(default=None, ge=0)
    error_text: str | None = None


class AttemptOut(BaseModel):
    """Сохранённая попытка."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    is_correct: bool
    duration_seconds: int | None
    error_text: str | None
    created_at: datetime


class ProgressOut(BaseModel):
    """Состояние задачи после попытки — фронт обновляет им карточку."""

    model_config = ConfigDict(from_attributes=True)

    status: str
    attempts_count: int
    first_solved_at: datetime | None
    last_attempt_at: datetime | None
    personal_note_md: str | None


class NoteIn(BaseModel):
    """Личная заметка к задаче. Хранится только в БД, в репозиторий не попадает."""

    personal_note_md: str | None = None


class StatusIn(BaseModel):
    """Ручная смена статуса задачи (например, отметить «сдался»)."""

    status: str
