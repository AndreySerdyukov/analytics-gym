"""Проверка контента: формат файлов + реальный прогон эталонных SQL на живом Postgres.

Смысл второй части: задача, чьё эталонное решение не выполняется, бесполезна — а обнаружится
это через месяц, когда сядешь её повторять. Здесь ошибка всплывает сразу при написании.

Проверка выполняется во временной схеме внутри транзакции, которая всегда откатывается:
рабочая база не меняется.
"""

import argparse
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import engine
from tools.loader import ContentBundle, load_content
from tools.parse import ContentError, ParsedTask

TEMP_SCHEMA = "gym_validate_tmp"


def _group_tasks_by_dataset(bundle: ContentBundle) -> dict[str, list[ParsedTask]]:
    """Группирует задачи по датасету: накатывать данные выгоднее один раз на группу."""
    grouped: dict[str, list[ParsedTask]] = {}
    for task in bundle.tasks:
        if task.meta.dataset and task.solution_sql:
            grouped.setdefault(task.meta.dataset, []).append(task)
    return grouped


def _exec_raw(conn, sql: str) -> tuple[bool, list]:
    """Выполняет SQL как есть и возвращает (вернул ли строки, сами строки).

    Идём через сырой курсор psycopg, а не через `exec_driver_sql`: SQLAlchemy трактует `%`
    как плейсхолдер параметра, а в наших датасетах `%` — это оператор взятия остатка.
    """
    with conn.connection.cursor() as cursor:
        cursor.execute(sql)
        if cursor.description is None:
            return False, []
        return True, cursor.fetchall()


def check_structure(bundle: ContentBundle) -> list[str]:
    """Проверки, не требующие БД: наличие решения там, где оно должно быть."""
    problems: list[str] = []
    for task in bundle.tasks:
        if task.solution_sql and not task.meta.dataset:
            problems.append(
                f"{task.path}: есть sql-решение, но не указан dataset — его негде выполнить"
            )
        if task.meta.dataset and not task.solution_sql:
            problems.append(
                f"{task.path}: указан dataset, но в разделе `## Решение` нет ```sql-блока"
            )
        if not task.solution_md:
            problems.append(f"{task.path}: нет раздела `## Решение`")
    return problems


def run_reference_sql(bundle: ContentBundle) -> list[str]:
    """Выполняет эталонные решения поверх их датасетов. Возвращает список ошибок."""
    problems: list[str] = []
    grouped = _group_tasks_by_dataset(bundle)

    for dataset_slug, tasks in grouped.items():
        dataset = bundle.dataset_by_slug(dataset_slug)
        if dataset is None:  # уже отловлено в load_content
            continue

        try:
            with engine.connect() as conn:
                transaction = conn.begin()
                try:
                    conn.execute(text(f'DROP SCHEMA IF EXISTS "{TEMP_SCHEMA}" CASCADE'))
                    conn.execute(text(f'CREATE SCHEMA "{TEMP_SCHEMA}"'))
                    conn.execute(text(f'SET LOCAL search_path TO "{TEMP_SCHEMA}"'))

                    try:
                        _exec_raw(conn, dataset.schema_sql)
                        if dataset.seed_sql:
                            _exec_raw(conn, dataset.seed_sql)
                    except Exception as exc:
                        problems.append(f"{dataset.path}: датасет не накатывается: {exc}")
                        continue

                    for task in tasks:
                        savepoint = conn.begin_nested()
                        try:
                            returns_rows, rows = _exec_raw(conn, task.solution_sql or "")
                            if not returns_rows:
                                problems.append(
                                    f"{task.path}: эталонное решение ничего не возвращает — "
                                    f"ожидается SELECT"
                                )
                            elif not rows:
                                problems.append(
                                    f"{task.path}: эталонное решение возвращает 0 строк — "
                                    f"проверь датасет или условие"
                                )
                        except Exception as exc:
                            problems.append(f"{task.path}: эталонное решение падает: {exc}")
                        finally:
                            # Откатываем побочные эффекты решения, датасет остаётся чистым.
                            savepoint.rollback()
                finally:
                    transaction.rollback()
        except SQLAlchemyError as exc:
            problems.append(
                f"не удалось подключиться к БД для проверки датасета '{dataset_slug}': {exc}\n"
                f"  подсказка: docker compose up -d db"
            )
            break

    return problems


def main(argv: list[str] | None = None) -> int:
    """Точка входа команды `python -m tools validate`."""
    parser = argparse.ArgumentParser(
        prog="tools validate", description="Проверка контента и эталонных SQL-решений"
    )
    parser.add_argument(
        "--skip-sql", action="store_true", help="Только формат, без обращения к базе"
    )
    parser.add_argument(
        "--content-dir", type=Path, default=settings.content_dir, help="Каталог с контентом"
    )
    args = parser.parse_args(argv)

    try:
        bundle, problems = load_content(args.content_dir)
    except ContentError as exc:
        print(f"✗ {exc}")
        return 1

    problems += check_structure(bundle)
    if not args.skip_sql:
        problems += run_reference_sql(bundle)

    if problems:
        print(f"✗ Найдено проблем: {len(problems)}\n")
        for problem in problems:
            print(f"  • {problem}")
        return 1

    print(
        f"✓ Контент в порядке: "
        f"{len(bundle.tasks)} задач, {len(bundle.notes)} конспектов, "
        f"{sum(len(n.cards) for n in bundle.notes)} карточек, {len(bundle.datasets)} датасетов"
    )
    return 0
