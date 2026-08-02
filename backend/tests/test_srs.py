"""Алгоритм интервальных повторений SM-2.

Те же кейсы продублированы в `frontend/src/data/srs.test.ts`: реализации на Python и
TypeScript должны вести себя одинаково, иначе прогресс в демо и в локальном режиме разойдётся.
"""

from datetime import date

import pytest

from app.services.srs import (
    DEFAULT_EASE_FACTOR,
    GRADE_EASY,
    GRADE_FORGOT,
    GRADE_HARD,
    MIN_EASE_FACTOR,
    initial_state,
    review,
)

TODAY = date(2026, 8, 2)


def test_novaya_kartochka_pokazyvaetsya_segodnya() -> None:
    state = initial_state(TODAY)
    assert state.due_date == TODAY
    assert state.repetitions == 0
    assert state.ease_factor == DEFAULT_EASE_FACTOR


def test_pervyy_uspeh_daet_odin_den() -> None:
    outcome = review(
        ease_factor=DEFAULT_EASE_FACTOR, interval_days=0, repetitions=0, grade=GRADE_EASY, today=TODAY
    )
    assert outcome.interval_days == 1
    assert outcome.due_date == date(2026, 8, 3)
    assert outcome.repetitions == 1


def test_vtoroy_uspeh_daet_shest_dney() -> None:
    outcome = review(
        ease_factor=DEFAULT_EASE_FACTOR, interval_days=1, repetitions=1, grade=GRADE_EASY, today=TODAY
    )
    assert outcome.interval_days == 6
    assert outcome.due_date == date(2026, 8, 8)


def test_dalshe_interval_umnozhaetsya_na_ease_factor() -> None:
    outcome = review(
        ease_factor=2.5, interval_days=6, repetitions=2, grade=GRADE_EASY, today=TODAY
    )
    # 6 × 2.6 (ease factor вырос за лёгкий ответ) = 15.6 → 16
    assert outcome.interval_days == 16
    assert outcome.repetitions == 3


def test_zabyl_sbrasyvaet_seriyu_i_vozvrashchaet_zavtra() -> None:
    outcome = review(
        ease_factor=2.5, interval_days=30, repetitions=5, grade=GRADE_FORGOT, today=TODAY
    )
    assert outcome.interval_days == 1
    assert outcome.repetitions == 0
    assert outcome.due_date == date(2026, 8, 3)
    # Коэффициент всё равно падает: карточка, которую забывают, должна расти медленнее.
    assert outcome.ease_factor < 2.5


def test_s_trudom_prodvigaet_seriyu_no_snizhaet_ease_factor() -> None:
    outcome = review(
        ease_factor=2.5, interval_days=6, repetitions=2, grade=GRADE_HARD, today=TODAY
    )
    assert outcome.repetitions == 3
    assert outcome.ease_factor < 2.5
    assert outcome.interval_days > 6


def test_ease_factor_ne_padaet_nizhe_predela() -> None:
    ease = DEFAULT_EASE_FACTOR
    for _ in range(20):
        ease = review(
            ease_factor=ease, interval_days=1, repetitions=0, grade=GRADE_FORGOT, today=TODAY
        ).ease_factor
    assert ease == MIN_EASE_FACTOR


def test_legkiy_otvet_povyshaet_ease_factor() -> None:
    outcome = review(
        ease_factor=2.5, interval_days=6, repetitions=2, grade=GRADE_EASY, today=TODAY
    )
    assert outcome.ease_factor > 2.5


def test_nedopustimaya_ocenka_otklonyaetsya() -> None:
    with pytest.raises(ValueError):
        review(ease_factor=2.5, interval_days=1, repetitions=1, grade=4, today=TODAY)
