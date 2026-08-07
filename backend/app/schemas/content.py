"""DTO контентной части: блоки, темы, задачи, датасеты."""

from pydantic import BaseModel, ConfigDict


class TopicOut(BaseModel):
    """Тема внутри блока."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    sort_order: int


class BlockOut(BaseModel):
    """Блок тренажёра со сводкой прогресса для дашборда."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    description: str | None
    icon: str | None
    sort_order: int
    topics: list[TopicOut] = []
    tasks_total: int = 0
    tasks_solved: int = 0
    # Сводка по теории едет вместе с блоком: хабу блока и дашборду не нужен отдельный запрос.
    notes_total: int = 0
    notes_read: int = 0


class DatasetOut(BaseModel):
    """Датасет для SQL-задачи: фронт накатывает его в PGlite перед решением."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    schema_sql: str
    seed_sql: str
    er_description: str | None


class TaskListItemOut(BaseModel):
    """Строка списка задач: только то, что нужно для карточки и фильтров."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    block_slug: str
    topic_slug: str | None
    difficulty: str
    tags: list[str]
    source: str | None
    company: str | None
    estimated_minutes: int | None
    status: str = "new"
    attempts_count: int = 0


class TaskDetailOut(TaskListItemOut):
    """Полная задача: условие, решение, разбор, датасет и личная заметка."""

    statement_md: str
    solution_md: str | None
    explanation_md: str | None
    solution_sql: str | None
    check_config: dict
    dataset: DatasetOut | None = None
    personal_note_md: str | None = None
