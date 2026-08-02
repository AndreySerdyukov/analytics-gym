"""Правила статусов задачи. Чистые функции без БД и FastAPI — тестируются изолированно.

Те же правила продублированы на TypeScript в `frontend/src/data/static-source.ts` для
статического демо. Если меняешь их здесь, поменяй и там: тест-кейсы у них общие.
"""

from datetime import datetime

# Порядок важен: статус, полученный однажды, не понижается сам собой.
NEW = "new"
IN_PROGRESS = "in_progress"
SOLVED = "solved"
FAILED = "failed"


def next_status(current: str, is_correct: bool) -> str:
    """Статус задачи после очередной попытки.

    Верная попытка всегда переводит в `solved`. Неудачная поднимает `new` до `in_progress`,
    но не сбрасывает уже решённую задачу: одна ошибка спустя месяц не должна стирать факт,
    что задача была решена.
    """
    if is_correct:
        return SOLVED
    if current == NEW:
        return IN_PROGRESS
    return current


def first_solved_at(current: datetime | None, is_correct: bool, now: datetime) -> datetime | None:
    """Момент первого верного решения. Однажды проставленный, он больше не меняется."""
    if current is not None:
        return current
    return now if is_correct else None
