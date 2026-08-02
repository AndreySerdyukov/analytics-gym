"""Сборка роутеров версии v1."""

from fastapi import APIRouter

from app.api.v1.blocks import router as blocks_router
from app.api.v1.review import router as review_router
from app.api.v1.stats import router as stats_router
from app.api.v1.tasks import router as tasks_router

api_router = APIRouter()
api_router.include_router(blocks_router)
api_router.include_router(tasks_router)
api_router.include_router(review_router)
api_router.include_router(stats_router)

__all__ = ["api_router"]
