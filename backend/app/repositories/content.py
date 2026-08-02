"""Доступ к контентным таблицам. Весь SQL контентной части — здесь."""

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Block, Dataset, Task, TaskProgress, Topic


def list_blocks(db: Session) -> list[Block]:
    """Все активные блоки с темами, в заданном порядке."""
    stmt = (
        select(Block)
        .where(Block.is_archived.is_(False))
        .options(selectinload(Block.topics))
        .order_by(Block.sort_order, Block.slug)
    )
    return list(db.scalars(stmt))


def block_task_counts(db: Session) -> dict[str, tuple[int, int]]:
    """Сводка по блокам: (всего задач, решено). Ключ — slug блока.

    Решённой считается задача со статусом `solved` в персональном прогрессе.
    """
    stmt = (
        select(
            Block.slug,
            func.count(Task.id),
            func.count(TaskProgress.id).filter(TaskProgress.status == "solved"),
        )
        .select_from(Block)
        .outerjoin(Task, (Task.block_id == Block.id) & (Task.is_archived.is_(False)))
        .outerjoin(TaskProgress, TaskProgress.task_id == Task.id)
        .group_by(Block.slug)
    )
    return {slug: (total, solved) for slug, total, solved in db.execute(stmt)}


def _tasks_base_query() -> Select:
    """Базовый запрос списка задач: задача + блок + тема + прогресс (может отсутствовать).

    Слаги блока и темы тянем прямо в выборку, а не через relationship: иначе на списке из
    сотни задач получили бы сотню дополнительных запросов.
    """
    return (
        select(Task, Block.slug, Topic.slug, TaskProgress)
        .join(Block, Block.id == Task.block_id)
        .outerjoin(Topic, Topic.id == Task.topic_id)
        .outerjoin(TaskProgress, TaskProgress.task_id == Task.id)
        .where(Task.is_archived.is_(False))
    )


def list_tasks(
    db: Session,
    *,
    block_slug: str | None = None,
    difficulty: str | None = None,
    tags: list[str] | None = None,
    status: str | None = None,
    company: str | None = None,
    search: str | None = None,
) -> list[tuple[Task, str, str | None, TaskProgress | None]]:
    """Список задач с применёнными фильтрами.

    Фильтр по статусу учитывает, что прогресса может не быть вовсе: отсутствие строки в
    task_progress эквивалентно статусу `new`.
    """
    stmt = _tasks_base_query()

    if block_slug:
        stmt = stmt.where(Block.slug == block_slug)
    if difficulty:
        stmt = stmt.where(Task.difficulty == difficulty)
    if tags:
        # Задача должна содержать ВСЕ перечисленные теги.
        stmt = stmt.where(Task.tags.contains(tags))
    if company:
        stmt = stmt.where(Task.company == company)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Task.title.ilike(pattern), Task.statement_md.ilike(pattern)))
    if status:
        if status == "new":
            stmt = stmt.where(
                or_(TaskProgress.id.is_(None), TaskProgress.status == "new")
            )
        else:
            stmt = stmt.where(TaskProgress.status == status)

    stmt = stmt.order_by(Block.sort_order, Task.position, Task.slug)
    return [
        (task, block_slug_, topic_slug, progress)
        for task, block_slug_, topic_slug, progress in db.execute(stmt)
    ]


def get_task_by_slug(
    db: Session, slug: str
) -> tuple[Task, str, str | None, TaskProgress | None] | None:
    """Одна задача по slug вместе с блоком, темой и прогрессом."""
    stmt = _tasks_base_query().where(Task.slug == slug)
    row = db.execute(stmt).first()
    if row is None:
        return None
    task, block_slug_, topic_slug, progress = row
    return task, block_slug_, topic_slug, progress


def get_dataset(db: Session, dataset_id: int) -> Dataset | None:
    """Датасет по идентификатору — фронт накатывает его в PGlite."""
    return db.get(Dataset, dataset_id)


def get_block_by_slug(db: Session, slug: str) -> Block | None:
    """Блок по slug."""
    stmt = select(Block).where(Block.slug == slug, Block.is_archived.is_(False))
    return db.scalars(stmt).first()


def list_companies(db: Session) -> list[str]:
    """Список компаний, встречающихся в задачах — для выпадающего фильтра."""
    stmt = (
        select(Task.company)
        .where(Task.company.is_not(None), Task.is_archived.is_(False))
        .distinct()
        .order_by(Task.company)
    )
    return [company for company in db.scalars(stmt) if company]


def list_tags(db: Session, block_slug: str | None = None) -> list[str]:
    """Уникальные теги задач, опционально в пределах блока — для панели фильтров."""
    tag = func.unnest(Task.tags).label("tag")
    stmt = select(tag).join(Block, Block.id == Task.block_id).where(Task.is_archived.is_(False))
    if block_slug:
        stmt = stmt.where(Block.slug == block_slug)
    stmt = stmt.distinct().order_by(tag)
    return list(db.scalars(stmt))
