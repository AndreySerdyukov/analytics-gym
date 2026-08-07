"""Роутер повторений и теории: очередь карточек, оценка, конспекты."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.review import (
    CardOut,
    GradeIn,
    NoteDetailOut,
    NoteListItemOut,
    NoteProgressOut,
    NoteReadIn,
    ReviewStateOut,
    ReviewSummaryOut,
)
from app.services import review as review_service

router = APIRouter(tags=["review"])


@router.get("/review/due", response_model=list[CardOut])
def due_cards(
    block: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[CardOut]:
    """Карточки, которые пора повторить: просроченные, сегодняшние и новые."""
    return review_service.due_cards(db, block_slug=block, limit=limit)


@router.get("/review/summary", response_model=ReviewSummaryOut)
def review_summary(db: Session = Depends(get_db)) -> ReviewSummaryOut:
    """Сколько карточек ждёт сегодня и сколько их всего."""
    return review_service.summary(db)


@router.post("/review/{slug}/grade", response_model=ReviewStateOut)
def grade_card(slug: str, payload: GradeIn, db: Session = Depends(get_db)) -> ReviewStateOut:
    """Оценивает карточку и назначает дату следующего показа."""
    return review_service.grade_card(db, slug, payload.grade)


@router.get("/notes", response_model=list[NoteListItemOut])
def list_notes(
    block: str | None = Query(default=None), db: Session = Depends(get_db)
) -> list[NoteListItemOut]:
    """Конспекты теории, опционально в пределах блока."""
    return review_service.list_notes(db, block)


@router.get("/notes/{slug}", response_model=NoteDetailOut)
def get_note(slug: str, db: Session = Depends(get_db)) -> NoteDetailOut:
    """Полный текст конспекта."""
    return review_service.get_note(db, slug)


@router.put("/notes/{slug}/read", response_model=NoteProgressOut)
def set_note_read(
    slug: str, payload: NoteReadIn, db: Session = Depends(get_db)
) -> NoteProgressOut:
    """Ставит или снимает отметку «прочитано». Повторный вызов ничего не ломает."""
    return review_service.set_note_read(db, slug, payload.is_read)
