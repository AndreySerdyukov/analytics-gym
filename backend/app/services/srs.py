"""Алгоритм интервальных повторений SM-2. Чистые функции, без БД и FastAPI.

Идея алгоритма: чем увереннее вспомнил карточку, тем дальше отодвигается следующий показ.
Забыл — интервал сбрасывается в один день, и карточка возвращается завтра.

Те же правила продублированы на TypeScript в `frontend/src/data/srs.ts` для статического демо.
Меняешь здесь — меняй и там: тест-кейсы у них общие.
"""

from dataclasses import dataclass
from datetime import date, timedelta

# Оценки самопроверки. Промежуточных значений намеренно нет: три кнопки, а не пять.
GRADE_FORGOT = 0
GRADE_HARD = 3
GRADE_EASY = 5
GRADES = (GRADE_FORGOT, GRADE_HARD, GRADE_EASY)

# Ниже этого коэффициента интервалы перестают расти осмысленно — классическая граница SM-2.
MIN_EASE_FACTOR = 1.3
DEFAULT_EASE_FACTOR = 2.5


@dataclass(frozen=True)
class ReviewOutcome:
    """Новое состояние карточки после оценки."""

    ease_factor: float
    interval_days: int
    repetitions: int
    due_date: date


def review(
    *,
    ease_factor: float,
    interval_days: int,
    repetitions: int,
    grade: int,
    today: date,
) -> ReviewOutcome:
    """Пересчитывает состояние карточки по оценке.

    Оценка ниже 3 считается провалом: серия повторений обнуляется, карточка возвращается
    завтра. Коэффициент лёгкости при этом всё равно уменьшается — карточка, которую забывают
    раз за разом, будет расти в интервалах медленнее остальных.
    """
    if grade not in GRADES:
        raise ValueError(f"Недопустимая оценка: {grade}")

    # Формула SM-2: чем ниже оценка, тем сильнее падает ease factor.
    updated_ease = ease_factor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
    updated_ease = max(MIN_EASE_FACTOR, round(updated_ease, 4))

    if grade < GRADE_HARD:
        return ReviewOutcome(
            ease_factor=updated_ease,
            interval_days=1,
            repetitions=0,
            due_date=today + timedelta(days=1),
        )

    if repetitions == 0:
        next_interval = 1
    elif repetitions == 1:
        next_interval = 6
    else:
        next_interval = max(1, round(interval_days * updated_ease))

    return ReviewOutcome(
        ease_factor=updated_ease,
        interval_days=next_interval,
        repetitions=repetitions + 1,
        due_date=today + timedelta(days=next_interval),
    )


def initial_state(today: date) -> ReviewOutcome:
    """Состояние карточки, которую ещё ни разу не показывали: она должна попасть в сегодня."""
    return ReviewOutcome(
        ease_factor=DEFAULT_EASE_FACTOR,
        interval_days=0,
        repetitions=0,
        due_date=today,
    )
