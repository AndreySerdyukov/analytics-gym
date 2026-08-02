"""Роутер блоков: список разделов тренажёра со сводкой прогресса."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.repositories import content as content_repo
from app.schemas.content import BlockOut
from app.services import tasks as tasks_service

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("", response_model=list[BlockOut])
def list_blocks(db: Session = Depends(get_db)) -> list[BlockOut]:
    """Все блоки с темами и сводкой «решено из N»."""
    return tasks_service.list_blocks(db)


@router.get("/filters", response_model=dict)
def list_filters(
    block: str | None = Query(default=None, description="Ограничить теги одним блоком"),
    db: Session = Depends(get_db),
) -> dict:
    """Справочники для панели фильтров: доступные теги и компании."""
    return {
        "tags": content_repo.list_tags(db, block_slug=block),
        "companies": content_repo.list_companies(db),
    }
