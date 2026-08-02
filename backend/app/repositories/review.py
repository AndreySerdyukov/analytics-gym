"""Доступ к карточкам и состоянию повторений. Весь SQL этой части — здесь."""

from datetime import date, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Block, Card, ReviewLog, ReviewState, TheoryNote


def list_due_cards(
    db: Session, *, today: date, block_slug: str | None = None, limit: int = 20
) -> list[tuple[Card, str, str | None, ReviewState | None]]:
    """Карточки к повторению: просроченные, сегодняшние и ни разу не показанные.

    Порядок — от самых просроченных к новым: сначала то, что вот-вот забудется.
    """
    stmt = (
        select(Card, Block.slug, TheoryNote.title, ReviewState)
        .join(Block, Block.id == Card.block_id)
        .outerjoin(TheoryNote, TheoryNote.id == Card.note_id)
        .outerjoin(ReviewState, ReviewState.card_id == Card.id)
        .where(Card.is_archived.is_(False))
        .where(or_(ReviewState.id.is_(None), ReviewState.due_date <= today))
        .order_by(func.coalesce(ReviewState.due_date, today), Card.block_id, Card.position)
        .limit(limit)
    )
    if block_slug:
        stmt = stmt.where(Block.slug == block_slug)
    return [tuple(row) for row in db.execute(stmt)]  # type: ignore[misc]


def count_due(db: Session, *, today: date) -> int:
    """Сколько карточек ждёт повторения сегодня — для счётчика в шапке."""
    stmt = (
        select(func.count(Card.id))
        .outerjoin(ReviewState, ReviewState.card_id == Card.id)
        .where(Card.is_archived.is_(False))
        .where(or_(ReviewState.id.is_(None), ReviewState.due_date <= today))
    )
    return db.scalar(stmt) or 0


def count_cards(db: Session) -> int:
    """Всего активных карточек."""
    stmt = select(func.count(Card.id)).where(Card.is_archived.is_(False))
    return db.scalar(stmt) or 0


def get_card_by_slug(db: Session, slug: str) -> Card | None:
    """Карточка по слагу."""
    stmt = select(Card).where(Card.slug == slug, Card.is_archived.is_(False))
    return db.scalars(stmt).first()


def get_state(db: Session, card_id: int) -> ReviewState | None:
    """Состояние повторений карточки или None, если её ещё не показывали."""
    stmt = select(ReviewState).where(ReviewState.card_id == card_id)
    return db.scalars(stmt).first()


def save_state(
    db: Session,
    *,
    card_id: int,
    ease_factor: float,
    interval_days: int,
    repetitions: int,
    due_date: date,
    grade: int,
    reviewed_at: datetime,
) -> ReviewState:
    """Сохраняет пересчитанное состояние карточки и пишет строку в историю."""
    state = get_state(db, card_id)
    if state is None:
        state = ReviewState(card_id=card_id, due_date=due_date)
        db.add(state)

    state.ease_factor = ease_factor
    state.interval_days = interval_days
    state.repetitions = repetitions
    state.due_date = due_date
    state.last_grade = grade
    state.last_reviewed_at = reviewed_at

    db.add(ReviewLog(card_id=card_id, grade=grade))
    db.flush()
    return state


def list_notes(
    db: Session, block_slug: str | None = None
) -> list[tuple[TheoryNote, str, int]]:
    """Конспекты теории с числом карточек в каждом."""
    cards_count = (
        select(func.count(Card.id))
        .where(Card.note_id == TheoryNote.id, Card.is_archived.is_(False))
        .scalar_subquery()
    )
    stmt = (
        select(TheoryNote, Block.slug, cards_count)
        .join(Block, Block.id == TheoryNote.block_id)
        .where(TheoryNote.is_archived.is_(False))
        .order_by(Block.sort_order, TheoryNote.position, TheoryNote.slug)
    )
    if block_slug:
        stmt = stmt.where(Block.slug == block_slug)
    return [tuple(row) for row in db.execute(stmt)]  # type: ignore[misc]


def get_note_by_slug(db: Session, slug: str) -> tuple[TheoryNote, str, int] | None:
    """Конспект по слагу вместе со слагом блока и числом его карточек."""
    cards_count = (
        select(func.count(Card.id))
        .where(Card.note_id == TheoryNote.id, Card.is_archived.is_(False))
        .scalar_subquery()
    )
    stmt = (
        select(TheoryNote, Block.slug, cards_count)
        .join(Block, Block.id == TheoryNote.block_id)
        .where(TheoryNote.slug == slug, TheoryNote.is_archived.is_(False))
    )
    row = db.execute(stmt).first()
    return (row[0], row[1], row[2]) if row else None
