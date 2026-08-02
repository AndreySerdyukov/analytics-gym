"""Базовый класс ORM-моделей (SQLAlchemy 2.x)."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Общий Base для всех ORM-моделей проекта."""

    pass
