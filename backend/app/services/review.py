"""Бизнес-логика повторений: очередь карточек на сегодня и применение оценки.

Модуль не импортирует FastAPI. Сам алгоритм интервалов живёт в `services/srs.py`.
"""

from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.repositories import personal as personal_repo
from app.repositories import review as review_repo
from app.schemas.review import (
    CardOut,
    NoteDetailOut,
    NoteListItemOut,
    NoteProgressOut,
    ReviewStateOut,
    ReviewSummaryOut,
)
from app.services import srs
from app.services.errors import NotFoundError, ValidationError


def due_cards(
    db: Session, *, block_slug: str | None = None, limit: int = 20, today: date | None = None
) -> list[CardOut]:
    """Карточки, которые пора повторить."""
    current_day = today or datetime.now(UTC).date()
    rows = review_repo.list_due_cards(
        db, today=current_day, block_slug=block_slug, limit=limit
    )
    return [
        CardOut(
            slug=card.slug,
            block_slug=block_slug_,
            note_title=note_title,
            question_md=card.question_md,
            answer_md=card.answer_md,
            repetitions=state.repetitions if state else 0,
            due_date=state.due_date if state else None,
        )
        for card, block_slug_, note_title, state in rows
    ]


def summary(db: Session, *, today: date | None = None) -> ReviewSummaryOut:
    """Сводка «сколько сегодня к повторению» для дашборда и шапки."""
    current_day = today or datetime.now(UTC).date()
    return ReviewSummaryOut(
        due_today=review_repo.count_due(db, today=current_day),
        cards_total=review_repo.count_cards(db),
    )


def grade_card(
    db: Session, slug: str, grade: int, *, today: date | None = None
) -> ReviewStateOut:
    """Применяет оценку к карточке и назначает дату следующего показа."""
    if grade not in srs.GRADES:
        raise ValidationError(
            f"Недопустимая оценка: {grade}. Ожидается одна из {list(srs.GRADES)}"
        )

    card = review_repo.get_card_by_slug(db, slug)
    if card is None:
        raise NotFoundError(f"Карточка не найдена: {slug}")

    current_day = today or datetime.now(UTC).date()
    state = review_repo.get_state(db, card.id)
    previous = (
        srs.ReviewOutcome(
            ease_factor=state.ease_factor,
            interval_days=state.interval_days,
            repetitions=state.repetitions,
            due_date=state.due_date,
        )
        if state
        else srs.initial_state(current_day)
    )

    outcome = srs.review(
        ease_factor=previous.ease_factor,
        interval_days=previous.interval_days,
        repetitions=previous.repetitions,
        grade=grade,
        today=current_day,
    )

    saved = review_repo.save_state(
        db,
        card_id=card.id,
        ease_factor=outcome.ease_factor,
        interval_days=outcome.interval_days,
        repetitions=outcome.repetitions,
        due_date=outcome.due_date,
        grade=grade,
        reviewed_at=datetime.now(UTC),
    )
    db.commit()
    return ReviewStateOut.model_validate(saved)


def list_notes(db: Session, block_slug: str | None = None) -> list[NoteListItemOut]:
    """Конспекты теории с темой, числом карточек и отметкой прочтения."""
    return [
        NoteListItemOut(
            slug=note.slug,
            block_slug=block_slug_,
            topic_slug=topic_slug,
            title=note.title,
            tags=list(note.tags or []),
            cards_count=cards_count,
            is_read=is_read,
        )
        for note, block_slug_, topic_slug, cards_count, is_read in review_repo.list_notes(
            db, block_slug
        )
    ]


def get_note(db: Session, slug: str) -> NoteDetailOut:
    """Полный конспект теории."""
    row = review_repo.get_note_by_slug(db, slug)
    if row is None:
        raise NotFoundError(f"Конспект не найден: {slug}")
    note, block_slug_, topic_slug, cards_count, is_read = row

    return NoteDetailOut(
        slug=note.slug,
        block_slug=block_slug_,
        topic_slug=topic_slug,
        title=note.title,
        tags=list(note.tags or []),
        cards_count=cards_count,
        is_read=is_read,
        body_md=note.body_md,
    )


def set_note_read(db: Session, slug: str, is_read: bool) -> NoteProgressOut:
    """Ставит или снимает отметку «прочитано».

    Снятие отметки очищает дату прочтения: «прочитал, потом передумал» не должно оставлять
    в истории дату, которой уже ничего не соответствует.
    """
    row = review_repo.get_note_by_slug(db, slug)
    if row is None:
        raise NotFoundError(f"Конспект не найден: {slug}")
    note = row[0]

    saved = personal_repo.set_note_read(
        db,
        note_id=note.id,
        is_read=is_read,
        read_at=datetime.now(UTC) if is_read else None,
    )
    db.commit()
    return NoteProgressOut(slug=note.slug, is_read=saved.is_read, read_at=saved.read_at)
