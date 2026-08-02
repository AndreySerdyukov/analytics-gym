"""Общие зависимости FastAPI (dependency injection)."""

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Выдаёт сессию БД на время запроса и гарантированно закрывает её."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
