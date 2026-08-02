"""Разбор контента: frontmatter, разделы, карточки, датасеты, слаги.

Часть тестов работает на реальном каталоге content/ — так проверяется не только парсер,
но и то, что настоящие файлы соответствуют формату.
"""

from pathlib import Path

import pytest

from tools.loader import load_content
from tools.parse import (
    ContentError,
    extract_sql,
    parse_cards,
    parse_filename,
    split_frontmatter,
    split_sections,
)
from tools.scaffold import slugify

TASK_SAMPLE = """---
title: Пример
block: sql
difficulty: medium
---

## Условие

Посчитай что-нибудь.

## Решение

```sql
SELECT 1;
```

## Разбор

Потому что.
"""


def test_frontmatter_otdelyaetsya_ot_tela() -> None:
    meta, body = split_frontmatter(Path("sample.md"), TASK_SAMPLE)
    assert meta["title"] == "Пример"
    assert meta["difficulty"] == "medium"
    assert body.startswith("## Условие")


def test_fail_bez_frontmatter() -> None:
    with pytest.raises(ContentError):
        split_frontmatter(Path("sample.md"), "## Условие\nбез заголовка")


def test_fail_bez_zakryvayushchey_stroki() -> None:
    with pytest.raises(ContentError):
        split_frontmatter(Path("sample.md"), "---\ntitle: Пример\n\n## Условие")


def test_razdely_razbirayutsya_po_zagolovkam() -> None:
    _, body = split_frontmatter(Path("sample.md"), TASK_SAMPLE)
    sections = split_sections(body)
    assert set(sections) == {"условие", "решение", "разбор"}
    assert sections["условие"] == "Посчитай что-нибудь."


def test_etalonnyy_sql_izvlekaetsya_iz_bloka() -> None:
    assert extract_sql("Текст\n```sql\nSELECT 1;\n```\nещё текст") == "SELECT 1;"
    assert extract_sql("```python\nprint(1)\n```") is None
    assert extract_sql(None) is None


def test_nomer_i_imya_beretsya_iz_imeni_fayla() -> None:
    assert parse_filename(Path("013-retention-d7.md")) == (13, "retention-d7")
    assert parse_filename(Path("bez-nomera.md")) == (0, "bez-nomera")


def test_kartochki_izvlekayutsya_parami() -> None:
    section = """### Q: Чем RANK отличается от DENSE_RANK?

RANK оставляет дыры.

### Когда считаются оконные функции?

После GROUP BY.
"""
    cards = parse_cards("sql-window", section)
    assert [card.slug for card in cards] == ["sql-window-c1", "sql-window-c2"]
    # Префикс `Q:` необязателен и срезается, если есть.
    assert cards[0].question_md == "Чем RANK отличается от DENSE_RANK?"
    assert cards[1].question_md == "Когда считаются оконные функции?"
    assert cards[1].answer_md == "После GROUP BY."


def test_kartochka_bez_otveta_propuskaetsya() -> None:
    assert parse_cards("sql-window", "### Q: Вопрос без ответа\n") == []


def test_slugify_transliteriruet_kirillicu() -> None:
    assert slugify("Retention D7 по когортам") == "retention-d7-po-kogortam"
    assert slugify("Оконные функции!") == "okonnye-funktsii"
    assert slugify("   ") == "untitled"


def test_realnyy_kontent_prohodit_proverku(content_dir: Path) -> None:
    """Файлы в content/ разбираются без единой проблемы со ссылками и слагами."""
    bundle, problems = load_content(content_dir)
    assert problems == []
    assert len(bundle.tasks) >= 10
    assert bundle.dataset_by_slug("ecommerce-v1") is not None


def test_u_kazhdoy_sql_zadachi_est_etalon(content_dir: Path) -> None:
    """Задача с датасетом обязана иметь выполнимый эталонный запрос — иначе её нечем проверить."""
    bundle, _ = load_content(content_dir)
    for task in bundle.tasks:
        if task.meta.dataset:
            assert task.solution_sql, f"нет sql-решения: {task.path}"
