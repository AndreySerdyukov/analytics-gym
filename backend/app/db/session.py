"""Движок и фабрика сессий SQLAlchemy."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# pool_pre_ping — проверка живости соединения перед выдачей из пула.
engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)
