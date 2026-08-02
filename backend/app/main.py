"""Точка сборки FastAPI-приложения analytics-gym."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import settings
from app.services.errors import NotFoundError, ValidationError

app = FastAPI(title="analytics-gym", version="0.1.0")

# CORS для локального фронта (Vite dev-сервер).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Доменные исключения из services мапим в HTTP здесь — сам слой services про HTTP не знает.
@app.exception_handler(NotFoundError)
def handle_not_found(request: Request, exc: NotFoundError) -> JSONResponse:
    """Объект не найден — 404."""
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
def handle_validation(request: Request, exc: ValidationError) -> JSONResponse:
    """Доменная проверка не пройдена — 422."""
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Проверка живости сервиса (не обращается к БД)."""
    return {"status": "ok", "env": settings.app_env}


# Доменные роутеры — под префиксом /api/v1.
app.include_router(api_router, prefix="/api/v1")
