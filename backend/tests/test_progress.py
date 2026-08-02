"""Правила статусов задачи. Логика чистая, поэтому БД для тестов не нужна."""

from datetime import UTC, datetime

from app.services.progress import first_solved_at, next_status

NOW = datetime(2026, 8, 2, 12, 0, tzinfo=UTC)
EARLIER = datetime(2026, 7, 1, 9, 30, tzinfo=UTC)


def test_pervaya_neudachnaya_popytka_perevodit_v_rabotu() -> None:
    assert next_status("new", is_correct=False) == "in_progress"


def test_vernaya_popytka_reshaet_zadachu() -> None:
    assert next_status("new", is_correct=True) == "solved"
    assert next_status("in_progress", is_correct=True) == "solved"


def test_reshennaya_zadacha_ne_otkatyvaetsya_posle_oshibki() -> None:
    # Ошибка при повторном решении спустя месяц не должна стирать факт решения.
    assert next_status("solved", is_correct=False) == "solved"


def test_status_sdalsya_sohranyaetsya_do_vernogo_resheniya() -> None:
    assert next_status("failed", is_correct=False) == "failed"
    assert next_status("failed", is_correct=True) == "solved"


def test_moment_pervogo_resheniya_prostavlyaetsya_odnazhdy() -> None:
    assert first_solved_at(None, is_correct=True, now=NOW) == NOW
    assert first_solved_at(None, is_correct=False, now=NOW) is None
    # Повторное верное решение не сдвигает дату первого.
    assert first_solved_at(EARLIER, is_correct=True, now=NOW) == EARLIER
