"""Разбор файлов content/: frontmatter, секции, карточки, датасеты.

Формат намеренно простой, чтобы задачу можно было написать в любом редакторе:
- задача и конспект — Markdown с YAML-frontmatter между строками `---`;
- разделы задачи — заголовки второго уровня `## Условие`, `## Решение`, `## Разбор`;
- карточки — в разделе `## Карточки` конспекта, вопрос в `### Q: ...`, дальше ответ;
- датасет — обычный .sql с комментариями-метаданными и маркером `-- seed`.
"""

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from tools.schema import NoteFrontmatter, TaskFrontmatter

# Ведущий номер в имени файла: 001-retention-d7.md → position 1, name "retention-d7".
FILENAME_RE = re.compile(r"^(?:(\d+)[-_])?(.+)$")


class ContentError(Exception):
    """Ошибка в файле контента. Всегда содержит путь — чтобы сразу открыть и починить."""

    def __init__(self, path: Path, message: str) -> None:
        super().__init__(f"{path}: {message}")
        self.path = path
        self.message = message


def content_hash(text: str) -> str:
    """Хеш содержимого — позволяет sync пропускать неизменённые файлы."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_frontmatter(path: Path, text: str) -> tuple[dict, str]:
    """Делит файл на YAML-frontmatter и тело."""
    if not text.startswith("---"):
        raise ContentError(path, "файл должен начинаться с frontmatter между строками ---")

    parts = text.split("\n", 1)
    if len(parts) < 2:
        raise ContentError(path, "пустой файл")

    end = parts[1].find("\n---")
    if end == -1:
        raise ContentError(path, "не найдена закрывающая строка --- у frontmatter")

    raw_meta = parts[1][:end]
    body = parts[1][end + len("\n---") :].lstrip("\n")

    try:
        meta = yaml.safe_load(raw_meta) or {}
    except yaml.YAMLError as exc:
        raise ContentError(path, f"некорректный YAML во frontmatter: {exc}") from exc
    if not isinstance(meta, dict):
        raise ContentError(path, "frontmatter должен быть словарём")
    return meta, body


def split_sections(body: str) -> dict[str, str]:
    """Разбивает тело на разделы по заголовкам `## `. Ключи приводятся к нижнему регистру."""
    sections: dict[str, str] = {}
    current: str | None = None
    buffer: list[str] = []

    for line in body.splitlines():
        if line.startswith("## "):
            if current is not None:
                sections[current] = "\n".join(buffer).strip()
            current = line[3:].strip().lower()
            buffer = []
        else:
            buffer.append(line)

    if current is not None:
        sections[current] = "\n".join(buffer).strip()
    return sections


def extract_sql(markdown: str | None) -> str | None:
    """Достаёт код первого ```sql-блока — это и есть эталонный запрос."""
    if not markdown:
        return None
    match = re.search(r"```sql\s*\n(.*?)```", markdown, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else None


def parse_filename(path: Path) -> tuple[int, str]:
    """Возвращает (порядковый номер, имя без номера) из имени файла."""
    match = FILENAME_RE.match(path.stem)
    if match is None:  # pragma: no cover — регулярка матчит любую непустую строку
        raise ContentError(path, "не удалось разобрать имя файла")
    number, name = match.groups()
    return (int(number) if number else 0), name


@dataclass
class ParsedTask:
    """Разобранная задача, готовая к валидации и заливке в БД."""

    path: Path
    slug: str
    position: int
    meta: TaskFrontmatter
    statement_md: str
    solution_md: str | None
    explanation_md: str | None
    solution_sql: str | None
    content_hash: str


@dataclass
class ParsedCard:
    """Карточка для интервальных повторений, извлечённая из конспекта."""

    slug: str
    question_md: str
    answer_md: str
    position: int


@dataclass
class ParsedNote:
    """Разобранный конспект теории вместе с его карточками."""

    path: Path
    slug: str
    position: int
    meta: NoteFrontmatter
    body_md: str
    content_hash: str
    cards: list[ParsedCard] = field(default_factory=list)


@dataclass
class ParsedDataset:
    """Разобранный датасет: структура и наполнение разделены."""

    path: Path
    slug: str
    title: str
    schema_sql: str
    seed_sql: str
    er_description: str | None
    content_hash: str


def parse_task(path: Path) -> ParsedTask:
    """Читает и разбирает файл задачи."""
    text = path.read_text(encoding="utf-8")
    meta_raw, body = split_frontmatter(path, text)

    try:
        meta = TaskFrontmatter.model_validate(meta_raw)
    except Exception as exc:
        raise ContentError(path, f"frontmatter не проходит проверку: {exc}") from exc

    sections = split_sections(body)
    statement = sections.get("условие")
    if not statement:
        raise ContentError(path, "нет раздела `## Условие` или он пустой")

    solution = sections.get("решение") or None
    explanation = sections.get("разбор") or None

    position, name = parse_filename(path)
    return ParsedTask(
        path=path,
        slug=f"{meta.block}-{name}",
        position=position,
        meta=meta,
        statement_md=statement,
        solution_md=solution,
        explanation_md=explanation,
        solution_sql=extract_sql(solution),
        content_hash=content_hash(text),
    )


def parse_cards(note_slug: str, cards_section: str) -> list[ParsedCard]:
    """Разбирает раздел `## Карточки` на пары вопрос-ответ.

    Слаг карточки строится от слага конспекта и её позиции: карточка переживает пересинк и
    сохраняет историю повторений, пока не меняется её порядок в файле.
    """
    cards: list[ParsedCard] = []
    current_question: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if current_question is None:
            return
        answer = "\n".join(buffer).strip()
        if not answer:
            return
        cards.append(
            ParsedCard(
                slug=f"{note_slug}-c{len(cards) + 1}",
                question_md=current_question,
                answer_md=answer,
                position=len(cards) + 1,
            )
        )

    for line in cards_section.splitlines():
        if line.startswith("### "):
            flush()
            heading = line[4:].strip()
            # Префикс `Q:` необязателен, но привычен — срезаем, если он есть.
            current_question = re.sub(r"^Q\s*:\s*", "", heading, flags=re.IGNORECASE)
            buffer = []
        else:
            buffer.append(line)
    flush()
    return cards


def parse_note(path: Path) -> ParsedNote:
    """Читает и разбирает конспект теории вместе с карточками."""
    text = path.read_text(encoding="utf-8")
    meta_raw, body = split_frontmatter(path, text)

    try:
        meta = NoteFrontmatter.model_validate(meta_raw)
    except Exception as exc:
        raise ContentError(path, f"frontmatter не проходит проверку: {exc}") from exc

    sections = split_sections(body)
    position, name = parse_filename(path)
    slug = f"{meta.block}-{name}"

    cards_section = sections.get("карточки", "")
    return ParsedNote(
        path=path,
        slug=slug,
        position=position,
        meta=meta,
        body_md=body,
        content_hash=content_hash(text),
        cards=parse_cards(slug, cards_section),
    )


def parse_dataset(path: Path) -> ParsedDataset:
    """Читает .sql-датасет: метаданные из комментариев, структура и наполнение по маркеру."""
    text = path.read_text(encoding="utf-8")

    title_match = re.search(r"^--\s*title:\s*(.+)$", text, re.MULTILINE)
    desc_match = re.search(r"^--\s*description:\s*(.+)$", text, re.MULTILINE)

    # Всё до строки `-- seed` — структура, после — наполнение.
    parts = re.split(r"^--\s*seed\s*$", text, maxsplit=1, flags=re.MULTILINE)
    schema_sql = parts[0].strip()
    seed_sql = parts[1].strip() if len(parts) > 1 else ""

    if not schema_sql:
        raise ContentError(path, "датасет пустой: нет ни одной инструкции CREATE")

    _, name = parse_filename(path)
    return ParsedDataset(
        path=path,
        slug=name,
        title=title_match.group(1).strip() if title_match else name,
        schema_sql=schema_sql,
        seed_sql=seed_sql,
        er_description=desc_match.group(1).strip() if desc_match else None,
        content_hash=content_hash(text),
    )
