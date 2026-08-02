"""DTO страницы статистики."""

from datetime import date

from pydantic import BaseModel


class TotalsOut(BaseModel):
    """Сводка одной строкой."""

    tasks_total: int
    tasks_solved: int
    attempts_total: int
    attempts_correct: int
    cards_total: int
    cards_learned: int


class BlockStatsOut(BaseModel):
    """Прогресс по блоку."""

    block_slug: str
    title: str
    tasks_total: int
    tasks_solved: int
    attempts: int
    avg_solve_seconds: int | None


class TagStatsOut(BaseModel):
    """Срез по тегу: где больше всего неудачных попыток, там и слабое место."""

    tag: str
    tasks_total: int
    tasks_solved: int
    failed_attempts: int


class ActivityDayOut(BaseModel):
    """День календаря занятий."""

    day: date
    attempts: int
    reviews: int


class StatsOut(BaseModel):
    """Всё, что показывает страница статистики."""

    totals: TotalsOut
    by_block: list[BlockStatsOut]
    weak_tags: list[TagStatsOut]
    activity: list[ActivityDayOut]
    streak_days: int
