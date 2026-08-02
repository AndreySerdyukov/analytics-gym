"""Единственное место правды о формате контента.

Меняешь формат задач или конспектов — меняешь модели здесь, остальное подстраивается:
`validate` начнёт проверять новые поля, `sync` перенесёт их в БД.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Difficulty = Literal["easy", "medium", "hard"]
Source = Literal["interview", "course", "leetcode", "own"]


class CheckConfig(BaseModel):
    """Настройки сравнения результата запроса с эталоном."""

    model_config = ConfigDict(extra="forbid")

    # Важен ли порядок строк. По умолчанию нет: большинство задач не про ORDER BY.
    ordered: bool = False
    # Допуск при сравнении чисел — спасает от расхождений float в последнем знаке.
    tolerance: float = Field(default=0.001, ge=0)
    # Сравнивать по позициям колонок, а не по их именам.
    ignore_column_names: bool = True
    # Максимум строк, которые раннер покажет в результате.
    max_rows: int = Field(default=200, gt=0)


class TaskFrontmatter(BaseModel):
    """Заголовок .md-файла задачи."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    block: str = Field(min_length=1)
    topic: str | None = None
    difficulty: Difficulty
    tags: list[str] = Field(default_factory=list)
    source: Source | None = None
    company: str | None = None
    estimated_minutes: int | None = Field(default=None, gt=0)
    # Слаг датасета из content/<block>/datasets/. Обязателен для задач с SQL-раннером.
    dataset: str | None = None
    check: CheckConfig = Field(default_factory=CheckConfig)


class NoteFrontmatter(BaseModel):
    """Заголовок .md-файла конспекта теории."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    block: str = Field(min_length=1)
    topic: str | None = None
    tags: list[str] = Field(default_factory=list)


class TopicConfig(BaseModel):
    """Тема внутри блока (из content/blocks.yaml)."""

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    title: str = Field(min_length=1)


class BlockConfig(BaseModel):
    """Блок тренажёра (из content/blocks.yaml)."""

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str | None = None
    icon: str | None = None
    topics: list[TopicConfig] = Field(default_factory=list)


class BlocksFile(BaseModel):
    """Содержимое content/blocks.yaml."""

    model_config = ConfigDict(extra="forbid")

    blocks: list[BlockConfig]
