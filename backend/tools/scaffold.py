"""Создание заготовок контента: задача, конспект, датасет.

Цель — убрать трение. Задача, встретившаяся на собеседовании, должна записываться одной
командой, а не «сначала вспомнить формат frontmatter».
"""

import argparse
import re
from pathlib import Path

from app.core.config import settings

# Транслитерация для слагов: заголовки пишутся по-русски, URL должен остаться латиницей.
TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
}

TASK_TEMPLATE = """---
title: {title}
block: {block}
topic:
difficulty: medium
tags: []
source: interview
company:
estimated_minutes: 20
dataset:{dataset_hint}
check:
  ordered: false
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

TODO: что нужно посчитать и в каком виде вернуть результат.

## Решение

```sql
SELECT 1;
```

## Разбор

TODO: почему решение именно такое, где типичная ошибка, что спросят следом.
"""

NOTE_TEMPLATE = """---
title: {title}
block: {block}
topic:
tags: []
---

## Кратко

TODO: суть в трёх предложениях.

## Подробно

TODO: механика, примеры, подводные камни.

## Карточки

### Q: TODO вопрос

TODO ответ.
"""

DATASET_TEMPLATE = """-- title: {title}
-- description: TODO: какие таблицы и что моделируют

CREATE TABLE example (
    id   integer PRIMARY KEY,
    name text NOT NULL
);

-- seed
INSERT INTO example (id, name) VALUES
    (1, 'первая строка'),
    (2, 'вторая строка');
"""


def slugify(value: str) -> str:
    """Превращает заголовок в слаг: кириллица транслитерируется, пробелы становятся дефисами."""
    lowered = value.strip().lower()
    transliterated = "".join(TRANSLIT.get(char, char) for char in lowered)
    cleaned = re.sub(r"[^a-z0-9]+", "-", transliterated)
    return cleaned.strip("-") or "untitled"


def next_number(directory: Path, pattern: str = "*.md") -> int:
    """Следующий порядковый номер файла в каталоге."""
    numbers = []
    for path in directory.glob(pattern):
        match = re.match(r"^(\d+)[-_]", path.stem)
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def create_task(content_dir: Path, block: str, title: str, dataset: str | None = None) -> Path:
    """Создаёт файл задачи по шаблону и возвращает путь к нему."""
    directory = content_dir / block / "tasks"
    directory.mkdir(parents=True, exist_ok=True)

    path = directory / f"{next_number(directory):03d}-{slugify(title)}.md"
    if path.exists():
        raise FileExistsError(path)

    path.write_text(
        TASK_TEMPLATE.format(
            title=title, block=block, dataset_hint=f" {dataset}" if dataset else ""
        ),
        encoding="utf-8",
    )
    return path


def create_note(content_dir: Path, block: str, title: str) -> Path:
    """Создаёт файл конспекта теории."""
    directory = content_dir / "theory" / block
    directory.mkdir(parents=True, exist_ok=True)

    path = directory / f"{next_number(directory):03d}-{slugify(title)}.md"
    if path.exists():
        raise FileExistsError(path)

    path.write_text(NOTE_TEMPLATE.format(title=title, block=block), encoding="utf-8")
    return path


def create_dataset(content_dir: Path, block: str, title: str) -> Path:
    """Создаёт файл датасета."""
    directory = content_dir / block / "datasets"
    directory.mkdir(parents=True, exist_ok=True)

    path = directory / f"{slugify(title)}.sql"
    if path.exists():
        raise FileExistsError(path)

    path.write_text(DATASET_TEMPLATE.format(title=title), encoding="utf-8")
    return path


def _run(kind: str, argv: list[str] | None) -> int:
    """Общий разбор аргументов для трёх команд создания."""
    parser = argparse.ArgumentParser(
        prog=f"tools new-{kind}", description=f"Создать заготовку: {kind}"
    )
    parser.add_argument("block", help="Слаг блока: sql, stats-ab, python, ml")
    parser.add_argument("title", help="Заголовок (можно по-русски)")
    parser.add_argument(
        "--content-dir", type=Path, default=settings.content_dir, help="Каталог с контентом"
    )
    if kind == "task":
        parser.add_argument("--dataset", default=None, help="Слаг датасета для SQL-задачи")
    args = parser.parse_args(argv)

    creators = {
        "task": lambda: create_task(
            args.content_dir, args.block, args.title, getattr(args, "dataset", None)
        ),
        "note": lambda: create_note(args.content_dir, args.block, args.title),
        "dataset": lambda: create_dataset(args.content_dir, args.block, args.title),
    }

    try:
        path = creators[kind]()
    except FileExistsError as exc:
        print(f"✗ Файл уже существует: {exc}")
        return 1

    print(f"✓ {path}")
    return 0


def main_task(argv: list[str] | None = None) -> int:
    """Точка входа `python -m tools new-task`."""
    return _run("task", argv)


def main_note(argv: list[str] | None = None) -> int:
    """Точка входа `python -m tools new-note`."""
    return _run("note", argv)


def main_dataset(argv: list[str] | None = None) -> int:
    """Точка входа `python -m tools new-dataset`."""
    return _run("dataset", argv)
