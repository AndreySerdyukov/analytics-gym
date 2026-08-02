"""Обход каталога content/ и сборка всего контента с проверкой перекрёстных ссылок."""

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from tools.parse import (
    ContentError,
    ParsedDataset,
    ParsedNote,
    ParsedTask,
    parse_dataset,
    parse_note,
    parse_task,
)
from tools.schema import BlocksFile


@dataclass
class ContentBundle:
    """Весь контент репозитория в разобранном виде."""

    blocks: BlocksFile
    tasks: list[ParsedTask] = field(default_factory=list)
    notes: list[ParsedNote] = field(default_factory=list)
    datasets: list[ParsedDataset] = field(default_factory=list)

    def dataset_by_slug(self, slug: str) -> ParsedDataset | None:
        """Датасет по слагу."""
        return next((d for d in self.datasets if d.slug == slug), None)


def load_blocks(content_dir: Path) -> BlocksFile:
    """Читает content/blocks.yaml — справочник блоков и тем."""
    path = content_dir / "blocks.yaml"
    if not path.exists():
        raise ContentError(path, "не найден справочник блоков")

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise ContentError(path, f"некорректный YAML: {exc}") from exc

    try:
        return BlocksFile.model_validate(raw)
    except Exception as exc:
        raise ContentError(path, f"не проходит проверку: {exc}") from exc


def load_content(content_dir: Path) -> tuple[ContentBundle, list[str]]:
    """Собирает весь контент. Возвращает (контент, список проблем).

    Проблемы не бросаются исключением по одной: удобнее увидеть сразу все ошибки во всех
    файлах, чем чинить их по одной и перезапускать проверку.
    """
    problems: list[str] = []
    blocks = load_blocks(content_dir)
    known_blocks = {b.slug: {t.slug for t in b.topics} for b in blocks.blocks}

    bundle = ContentBundle(blocks=blocks)

    # Датасеты: content/<block>/datasets/*.sql
    for path in sorted(content_dir.glob("*/datasets/*.sql")):
        try:
            bundle.datasets.append(parse_dataset(path))
        except ContentError as exc:
            problems.append(str(exc))

    # Задачи: content/<block>/tasks/*.md
    for path in sorted(content_dir.glob("*/tasks/*.md")):
        try:
            bundle.tasks.append(parse_task(path))
        except ContentError as exc:
            problems.append(str(exc))

    # Конспекты: content/theory/<block>/*.md
    for path in sorted(content_dir.glob("theory/*/*.md")):
        try:
            bundle.notes.append(parse_note(path))
        except ContentError as exc:
            problems.append(str(exc))

    problems.extend(_check_references(bundle, known_blocks))
    problems.extend(_check_duplicates(bundle))
    return bundle, problems


def _check_references(bundle: ContentBundle, known_blocks: dict[str, set[str]]) -> list[str]:
    """Проверяет, что блоки, темы и датасеты, на которые ссылается контент, существуют."""
    problems: list[str] = []

    for task in bundle.tasks:
        block = task.meta.block
        if block not in known_blocks:
            problems.append(f"{task.path}: неизвестный блок '{block}' (нет в blocks.yaml)")
        elif task.meta.topic and task.meta.topic not in known_blocks[block]:
            problems.append(
                f"{task.path}: неизвестная тема '{task.meta.topic}' в блоке '{block}'"
            )
        # Каталог должен соответствовать блоку — иначе задача потеряется при переносе файлов.
        if task.path.parent.parent.name != block:
            problems.append(
                f"{task.path}: файл лежит в каталоге '{task.path.parent.parent.name}', "
                f"а во frontmatter block: {block}"
            )
        if task.meta.dataset and bundle.dataset_by_slug(task.meta.dataset) is None:
            problems.append(f"{task.path}: не найден датасет '{task.meta.dataset}'")

    for note in bundle.notes:
        block = note.meta.block
        if block not in known_blocks:
            problems.append(f"{note.path}: неизвестный блок '{block}' (нет в blocks.yaml)")
        elif note.meta.topic and note.meta.topic not in known_blocks[block]:
            problems.append(
                f"{note.path}: неизвестная тема '{note.meta.topic}' в блоке '{block}'"
            )
        if note.path.parent.name != block:
            problems.append(
                f"{note.path}: файл лежит в каталоге '{note.path.parent.name}', "
                f"а во frontmatter block: {block}"
            )

    return problems


def _check_duplicates(bundle: ContentBundle) -> list[str]:
    """Слаги должны быть уникальны: по ним идёт upsert и строятся URL."""
    problems: list[str] = []

    for label, slugs in (
        ("задач", [t.slug for t in bundle.tasks]),
        ("конспектов", [n.slug for n in bundle.notes]),
        ("датасетов", [d.slug for d in bundle.datasets]),
    ):
        for slug, count in Counter(slugs).items():
            if count > 1:
                problems.append(f"дубль слага {label}: '{slug}' встречается {count} раза")

    return problems
