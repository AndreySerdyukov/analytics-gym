"""Агрегаты по личной активности: прогресс, слабые темы, календарь занятий.

Считается по фактам — попыткам и повторениям, а не по самооценке.
"""

from datetime import date

from sqlalchemy import Date, Integer, cast, func, select
from sqlalchemy.orm import Session

from app.db.models import Attempt, Block, Card, ReviewLog, ReviewState, Task, TaskProgress


def totals(db: Session) -> dict[str, int]:
    """Сводные числа для верхней строки страницы статистики."""
    tasks_total = db.scalar(select(func.count(Task.id)).where(Task.is_archived.is_(False))) or 0
    tasks_solved = (
        db.scalar(select(func.count(TaskProgress.id)).where(TaskProgress.status == "solved")) or 0
    )
    attempts_total = db.scalar(select(func.count(Attempt.id))) or 0
    attempts_correct = (
        db.scalar(select(func.count(Attempt.id)).where(Attempt.is_correct.is_(True))) or 0
    )
    cards_total = db.scalar(select(func.count(Card.id)).where(Card.is_archived.is_(False))) or 0
    # «Выучена» — карточка, пережившая хотя бы три успешных повторения подряд.
    cards_learned = (
        db.scalar(select(func.count(ReviewState.id)).where(ReviewState.repetitions >= 3)) or 0
    )
    return {
        "tasks_total": tasks_total,
        "tasks_solved": tasks_solved,
        "attempts_total": attempts_total,
        "attempts_correct": attempts_correct,
        "cards_total": cards_total,
        "cards_learned": cards_learned,
    }


def by_block(db: Session) -> list[tuple[str, str, int, int, int, float | None]]:
    """По каждому блоку: всего задач, решено, попыток, среднее время решения."""
    solved = func.count(TaskProgress.id).filter(TaskProgress.status == "solved")
    attempts = (
        select(func.count(Attempt.id))
        .join(Task, Task.id == Attempt.task_id)
        .where(Task.block_id == Block.id)
        .scalar_subquery()
    )
    avg_seconds = (
        select(func.avg(Attempt.duration_seconds))
        .join(Task, Task.id == Attempt.task_id)
        .where(Task.block_id == Block.id, Attempt.is_correct.is_(True))
        .scalar_subquery()
    )

    stmt = (
        select(Block.slug, Block.title, func.count(Task.id), solved, attempts, avg_seconds)
        .select_from(Block)
        .outerjoin(Task, (Task.block_id == Block.id) & (Task.is_archived.is_(False)))
        .outerjoin(TaskProgress, TaskProgress.task_id == Task.id)
        .where(Block.is_archived.is_(False))
        .group_by(Block.id, Block.slug, Block.title, Block.sort_order)
        .order_by(Block.sort_order)
    )
    return [tuple(row) for row in db.execute(stmt)]  # type: ignore[misc]


def by_tag(db: Session, limit: int = 12) -> list[tuple[str, int, int, int]]:
    """По тегам: всего задач, решено, неудачных попыток.

    Сортировка по числу неудачных попыток: сверху оказывается то, на чём реально спотыкаешься,
    а не то, чего просто много.
    """
    tag = func.unnest(Task.tags).label("tag")
    tags_query = (
        select(Task.id.label("task_id"), tag)
        .where(Task.is_archived.is_(False))
        .subquery()
    )

    failed_attempts = func.count(Attempt.id).filter(Attempt.is_correct.is_(False))
    solved = func.count(func.distinct(TaskProgress.task_id)).filter(TaskProgress.status == "solved")

    stmt = (
        select(
            tags_query.c.tag,
            cast(func.count(func.distinct(tags_query.c.task_id)), Integer),
            solved,
            failed_attempts,
        )
        .select_from(tags_query)
        .outerjoin(TaskProgress, TaskProgress.task_id == tags_query.c.task_id)
        .outerjoin(Attempt, Attempt.task_id == tags_query.c.task_id)
        .group_by(tags_query.c.tag)
        .order_by(failed_attempts.desc(), tags_query.c.tag)
        .limit(limit)
    )
    return [tuple(row) for row in db.execute(stmt)]  # type: ignore[misc]


def activity(db: Session, since: date) -> dict[date, tuple[int, int]]:
    """Активность по дням: (попыток, повторений). Основа для календаря занятий."""
    attempts_stmt = (
        select(cast(Attempt.created_at, Date).label("day"), func.count(Attempt.id))
        .where(Attempt.created_at >= since)
        .group_by("day")
    )
    reviews_stmt = (
        select(cast(ReviewLog.reviewed_at, Date).label("day"), func.count(ReviewLog.id))
        .where(ReviewLog.reviewed_at >= since)
        .group_by("day")
    )

    result: dict[date, tuple[int, int]] = {}
    for day, count in db.execute(attempts_stmt):
        result[day] = (count, 0)
    for day, count in db.execute(reviews_stmt):
        attempts_count = result.get(day, (0, 0))[0]
        result[day] = (attempts_count, count)
    return result
