"""Общие фикстуры pytest."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """HTTP-клиент для тестов API (без реального сервера)."""
    return TestClient(app)


@pytest.fixture
def content_dir() -> Path:
    """Реальный каталог content/ — тесты парсера работают на настоящем контенте."""
    return Path(__file__).resolve().parents[2] / "content"
