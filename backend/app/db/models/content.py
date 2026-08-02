"""Контентные ORM-модели: блоки, темы, датасеты, задачи, теория, карточки.

Эти таблицы наполняются ТОЛЬКО командой `python -m tools sync` из каталога content/.
Приложение в них не пишет: источник правды — Markdown-файлы в git. Удалённый из content/
объект не удаляется физически (иначе потерялась бы персональная история), а помечается
`is_archived = true` и перестаёт показываться.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Допустимые значения — держим рядом с моделями, чтобы CHECK и валидация контента не разъезжались.
DIFFICULTIES = ("easy", "medium", "hard")
SOURCES = ("interview", "course", "leetcode", "own")


class Block(Base):
    """Раздел тренажёра: sql, stats-ab, python, ml. Задаётся в content/blocks.yaml."""

    __tablename__ = "blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # Эмодзи или короткий идентификатор иконки — фронт сам решает, как отрисовать.
    icon: Mapped[str | None] = mapped_column(String(32), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(default=False)

    topics: Mapped[list["Topic"]] = relationship(back_populates="block")


class Topic(Base):
    """Тема внутри блока: оконные функции, когорты, проверка гипотез."""

    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("block_id", "slug", name="uq_topics_block_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(128))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(default=False)

    block: Mapped[Block] = relationship(back_populates="topics")


class Dataset(Base):
    """Набор данных для SQL-задач: DDL и наполнение. Один датасет обслуживает 5–15 задач."""

    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128))
    # Разделены, чтобы фронт мог показать структуру таблиц отдельно от вставок.
    schema_sql: Mapped[str] = mapped_column(Text)
    seed_sql: Mapped[str] = mapped_column(Text)
    er_description: Mapped[str | None] = mapped_column(Text, default=None)
    content_hash: Mapped[str] = mapped_column(String(64))
    is_archived: Mapped[bool] = mapped_column(default=False)


class Task(Base):
    """Задача: условие, эталонное решение, разбор и метаданные для фильтров."""

    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')", name="ck_tasks_difficulty"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), index=True)
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"), default=None, index=True
    )
    dataset_id: Mapped[int | None] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), default=None
    )

    title: Mapped[str] = mapped_column(String(256))
    difficulty: Mapped[str] = mapped_column(String(16), index=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    source: Mapped[str | None] = mapped_column(String(32), default=None)
    company: Mapped[str | None] = mapped_column(String(128), default=None)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, default=None)

    statement_md: Mapped[str] = mapped_column(Text)
    solution_md: Mapped[str | None] = mapped_column(Text, default=None)
    explanation_md: Mapped[str | None] = mapped_column(Text, default=None)
    # Извлечённый из solution_md код первого sql-блока — то, что раннер выполняет как эталон.
    solution_sql: Mapped[str | None] = mapped_column(Text, default=None)
    # Настройки сравнения результатов: ordered, tolerance, ignore_column_names.
    check_config: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Порядковый номер из имени файла (001-...) — сохраняет заданный порядок задач.
    position: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str] = mapped_column(String(64))
    is_archived: Mapped[bool] = mapped_column(default=False, index=True)

    block: Mapped[Block] = relationship()
    topic: Mapped[Topic | None] = relationship()
    dataset: Mapped[Dataset | None] = relationship()


class TheoryNote(Base):
    """Конспект теории. Карточки для повторения извлекаются из его раздела `## Карточки`."""

    __tablename__ = "theory_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), index=True)
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"), default=None
    )
    title: Mapped[str] = mapped_column(String(256))
    body_md: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    position: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str] = mapped_column(String(64))
    is_archived: Mapped[bool] = mapped_column(default=False)

    block: Mapped[Block] = relationship()


class Card(Base):
    """Карточка для интервальных повторений. Слаг стабилен — по нему переживает пересинк."""

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), index=True)
    note_id: Mapped[int | None] = mapped_column(
        ForeignKey("theory_notes.id", ondelete="CASCADE"), default=None
    )
    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), default=None
    )
    question_md: Mapped[str] = mapped_column(Text)
    answer_md: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    block: Mapped[Block] = relationship()
