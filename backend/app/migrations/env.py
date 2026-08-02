"""Окружение Alembic: берёт DATABASE_URL из настроек, метаданные — из Base."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.db.models  # noqa: F401 — регистрирует ORM-модели в Base.metadata
from app.core.config import settings
from app.db.base import Base

config = context.config

# URL берём из pydantic-settings (а не из alembic.ini) — секрет только в .env.
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Миграции в offline-режиме (генерация SQL без подключения)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Миграции в online-режиме (через реальное подключение)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
