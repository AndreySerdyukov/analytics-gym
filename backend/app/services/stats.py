"""Бизнес-логика статистики: сборка среза активности и подсчёт серии занятий."""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.repositories import stats as stats_repo
from app.schemas.stats import (
    ActivityDayOut,
    BlockStatsOut,
    StatsOut,
    TagStatsOut,
    TotalsOut,
)

# Календарь занятий показывает примерно квартал — этого хватает, чтобы увидеть режим.
ACTIVITY_DAYS = 91


def current_streak(active_days: set[date], today: date) -> int:
    """Сколько дней подряд были занятия, считая от сегодня.

    Сегодняшний день без активности серию не обнуляет: день ещё не закончился, поэтому
    отсчёт в этом случае начинается со вчера.
    """
    start = today if today in active_days else today - timedelta(days=1)
    streak = 0
    day = start
    while day in active_days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def collect(db: Session, *, today: date | None = None) -> StatsOut:
    """Собирает всю статистику для страницы."""
    current_day = today or datetime.now(UTC).date()
    since = current_day - timedelta(days=ACTIVITY_DAYS - 1)

    raw_activity = stats_repo.activity(db, since)
    # Пустые дни тоже нужны: без них календарь занятий не построить.
    activity = [
        ActivityDayOut(
            day=since + timedelta(days=offset),
            attempts=raw_activity.get(since + timedelta(days=offset), (0, 0))[0],
            reviews=raw_activity.get(since + timedelta(days=offset), (0, 0))[1],
        )
        for offset in range(ACTIVITY_DAYS)
    ]
    active_days = {day for day, (attempts, reviews) in raw_activity.items() if attempts or reviews}

    return StatsOut(
        totals=TotalsOut(**stats_repo.totals(db)),
        by_block=[
            BlockStatsOut(
                block_slug=slug,
                title=title,
                tasks_total=total,
                tasks_solved=solved,
                attempts=attempts,
                avg_solve_seconds=round(avg_seconds) if avg_seconds else None,
            )
            for slug, title, total, solved, attempts, avg_seconds in stats_repo.by_block(db)
        ],
        weak_tags=[
            TagStatsOut(
                tag=tag, tasks_total=total, tasks_solved=solved, failed_attempts=failed
            )
            for tag, total, solved, failed in stats_repo.by_tag(db)
        ],
        activity=activity,
        streak_days=current_streak(active_days, current_day),
    )
