"""Выдача конспектов теории и отметки о прочтении.

Здесь нужен живой Postgres: проверяются именно запросы с несколькими outer join, которые
монкипатчем не поймать. Все данные создаются внутри транзакции теста и откатываются, поэтому
результат не зависит от того, что сейчас залито в базу командой `sync`.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Block, NoteProgress, TheoryNote, Topic
from app.repositories import content as content_repo
from app.services import review as review_service

BLOCK_SLUG = "test-theory-block"


def _make_block(db: Session) -> tuple[Block, Topic, Topic]:
    """Блок с двумя темами: обычной и архивной (тему убрали из blocks.yaml)."""
    block = Block(slug=BLOCK_SLUG, title="Тестовый блок", sort_order=99)
    db.add(block)
    db.flush()

    alive = Topic(block_id=block.id, slug="alive", title="Живая тема", sort_order=0)
    archived = Topic(
        block_id=block.id, slug="archived", title="Убранная тема", sort_order=1, is_archived=True
    )
    db.add_all([alive, archived])
    db.flush()
    return block, alive, archived


def _make_note(db: Session, block: Block, slug: str, topic: Topic | None, position: int) -> TheoryNote:
    """Конспект в тестовом блоке."""
    note = TheoryNote(
        slug=slug,
        block_id=block.id,
        topic_id=topic.id if topic else None,
        title=slug,
        body_md="тело",
        tags=[],
        position=position,
        content_hash=slug,
    )
    db.add(note)
    db.flush()
    return note


def test_konspekt_prihodit_so_slagom_temy(db: Session) -> None:
    block, alive, _ = _make_block(db)
    _make_note(db, block, "test-s-temoy", alive, 1)

    notes = review_service.list_notes(db, BLOCK_SLUG)

    assert [note.topic_slug for note in notes] == ["alive"]


def test_konspekt_bez_temy_ne_propadaet(db: Session) -> None:
    # Обычный join выкинул бы такой конспект из выдачи, и он исчез бы из навигации.
    block, _, _ = _make_block(db)
    _make_note(db, block, "test-bez-temy", None, 1)

    notes = review_service.list_notes(db, BLOCK_SLUG)

    assert len(notes) == 1
    assert notes[0].topic_slug is None


def test_ubrannaya_tema_daet_none_a_ne_teryaet_konspekt(db: Session) -> None:
    # Тема, удалённая из blocks.yaml, помечается is_archived. Конспект должен остаться.
    block, _, archived = _make_block(db)
    _make_note(db, block, "test-s-arhivnoy-temoy", archived, 1)

    notes = review_service.list_notes(db, BLOCK_SLUG)

    assert len(notes) == 1
    assert notes[0].topic_slug is None


def test_novyy_konspekt_ne_prochitan(db: Session) -> None:
    block, alive, _ = _make_block(db)
    _make_note(db, block, "test-novyy", alive, 1)

    assert review_service.list_notes(db, BLOCK_SLUG)[0].is_read is False


def test_otmetka_prochitano_vidna_v_spiske_i_v_konspekte(db: Session) -> None:
    block, alive, _ = _make_block(db)
    _make_note(db, block, "test-otmetka", alive, 1)

    saved = review_service.set_note_read(db, "test-otmetka", True)

    assert saved.is_read is True
    assert saved.read_at is not None
    assert review_service.list_notes(db, BLOCK_SLUG)[0].is_read is True
    assert review_service.get_note(db, "test-otmetka").is_read is True


def test_povtornaya_otmetka_ne_sozdaet_vtoruyu_stroku(db: Session) -> None:
    block, alive, _ = _make_block(db)
    note = _make_note(db, block, "test-idempotentnost", alive, 1)

    review_service.set_note_read(db, "test-idempotentnost", True)
    review_service.set_note_read(db, "test-idempotentnost", True)

    rows = db.scalar(
        select(func.count(NoteProgress.id)).where(NoteProgress.note_id == note.id)
    )
    assert rows == 1


def test_snyatie_otmetki_ochishchaet_datu(db: Session) -> None:
    block, alive, _ = _make_block(db)
    _make_note(db, block, "test-snyatie", alive, 1)

    review_service.set_note_read(db, "test-snyatie", True)
    saved = review_service.set_note_read(db, "test-snyatie", False)

    assert saved.is_read is False
    assert saved.read_at is None
    assert review_service.list_notes(db, BLOCK_SLUG)[0].is_read is False


def test_schetchik_konspektov_bloka(db: Session) -> None:
    block, alive, _ = _make_block(db)
    _make_note(db, block, "test-schetchik-1", alive, 1)
    _make_note(db, block, "test-schetchik-2", alive, 2)
    review_service.set_note_read(db, "test-schetchik-1", True)

    assert content_repo.block_note_counts(db)[BLOCK_SLUG] == (2, 1)


def test_schetchik_bloka_bez_konspektov(db: Session) -> None:
    # Блок без теории должен давать нули, а не выпадать из сводки.
    _make_block(db)

    assert content_repo.block_note_counts(db)[BLOCK_SLUG] == (0, 0)
