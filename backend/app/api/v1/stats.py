"""Роутер статистики."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.stats import StatsOut
from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)) -> StatsOut:
    """Прогресс по блокам, слабые темы, календарь занятий и текущая серия."""
    return stats_service.collect(db)
