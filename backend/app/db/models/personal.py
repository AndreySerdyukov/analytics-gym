"""Персональные ORM-модели: попытки, прогресс, состояние повторений, личные заметки.

Эти таблицы пишет ТОЛЬКО приложение. `python -m tools sync` их не трогает — снос и пересборка
контента не должны стирать личную историю. В публичный репозиторий содержимое не попадает.
"""

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

TASK_STATUSES = ("new", "in_progress", "solved", "failed")

# Оценки самопроверки в SM-2: забыл / с трудом / легко.
GRADE_FORGOT = 0
GRADE_HARD = 3
GRADE_EASY = 5


class Attempt(Base):
    """Одна попытка решения задачи. Основа честной статистики «где я тону»."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    submitted_code: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(default=False)
    # Время от открытия задачи до запуска проверки, секунды.
    duration_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
    # Текст ошибки Postgres или описание расхождения — чтобы потом видеть, на чём именно спотыкаюсь.
    error_text: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class TaskProgress(Base):
    """Агрегированное состояние по задаче: статус, счётчик попыток, личная заметка."""

    __tablename__ = "task_progress"
    __table_args__ = (
        CheckConstraint(
            "status IN ('new', 'in_progress', 'solved', 'failed')", name="ck_task_progress_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), unique=True, index=True
    )
    status: Mapped[str] = mapped_column(String(16), default="new", index=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    first_solved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    # Личная заметка «на чём погорел» — только в БД, в репозиторий не попадает.
    personal_note_md: Mapped[str | None] = mapped_column(Text, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ReviewState(Base):
    """Текущее состояние карточки в SM-2: когда показать снова и насколько она «лёгкая»."""

    __tablename__ = "review_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"), unique=True, index=True
    )
    # Коэффициент лёгкости SM-2, минимум 1.3.
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    last_grade: Mapped[int | None] = mapped_column(Integer, default=None)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )


class ReviewLog(Base):
    """История повторений — для статистики и heatmap активности."""

    __tablename__ = "review_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    grade: Mapped[int] = mapped_column(Integer)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
