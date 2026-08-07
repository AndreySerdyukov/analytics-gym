"""Общие фикстуры pytest."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import engine
from app.main import app


@pytest.fixture
def client() -> TestClient:
    """HTTP-клиент для тестов API (без реального сервера)."""
    return TestClient(app)


@pytest.fixture
def content_dir() -> Path:
    """Реальный каталог content/ — тесты парсера работают на настоящем контенте."""
    return Path(__file__).resolve().parents[2] / "content"


@pytest.fixture
def db() -> Iterator[Session]:
    """Сессия на живом Postgres: всё, что тест записал, откатывается вместе с транзакцией.

    Почти все тесты проекта чистые и базы не требуют, но запросы с несколькими outer join
    монкипатчем не проверишь. Если базы под рукой нет, тест пропускается: в CI Postgres есть
    всегда и миграции там накатываются до прогона.
    """
    try:
        connection = engine.connect()
    except Exception as exc:  # pragma: no cover — зависит от окружения, а не от кода
        pytest.skip(f"Postgres недоступен: {exc}")

    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
