"""Подсчёт серии занятий. Логика чистая, БД не нужна."""

from datetime import date, timedelta

from app.services.stats import current_streak

TODAY = date(2026, 8, 2)


def test_bez_aktivnosti_seriya_nulevaya() -> None:
    assert current_streak(set(), TODAY) == 0


def test_seriya_schitaetsya_ot_segodnya() -> None:
    days = {TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=2)}
    assert current_streak(days, TODAY) == 3


def test_propushchennyy_den_obryvaet_seriyu() -> None:
    # Пропуск позавчера: считаются только сегодня и вчера.
    days = {TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=3)}
    assert current_streak(days, TODAY) == 2


def test_segodnya_bez_zanyatiy_ne_obnulyaet_seriyu() -> None:
    # День ещё не закончился, поэтому отсчёт начинается со вчера.
    days = {TODAY - timedelta(days=1), TODAY - timedelta(days=2)}
    assert current_streak(days, TODAY) == 2


def test_davnyaya_aktivnost_ne_schitaetsya() -> None:
    days = {TODAY - timedelta(days=5), TODAY - timedelta(days=6)}
    assert current_streak(days, TODAY) == 0
