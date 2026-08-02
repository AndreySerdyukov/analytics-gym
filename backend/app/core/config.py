"""Конфигурация приложения через pydantic-settings (читается из окружения/.env)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Корень backend/ — от него отсчитываем путь к каталогу с контентом.
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Настройки приложения. Секреты — только через окружение, не хардкодим."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Строка подключения к PostgreSQL (SQLAlchemy + psycopg 3). Порт 5433 — см. docker-compose.yml.
    database_url: str = (
        "postgresql+psycopg://analytics_gym:analytics_gym@localhost:5433/analytics_gym"
    )

    # Окружение: development | production.
    app_env: str = "development"

    # Каталог с контентом (задачи, теория, датасеты) — источник правды, лежит рядом с backend/.
    content_dir: Path = BACKEND_DIR.parent / "content"


# Единый инстанс настроек на всё приложение.
settings = Settings()
