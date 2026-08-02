# analytics-gym — контекст для AI-ассистента

> Личный проект. Общие персональные конвенции (русский язык общения, `uv`, React+TS, слоистость,
> секреты через окружение, документационный слой) заданы в глобальном `~/.claude/CLAUDE.md` и
> действуют здесь автоматически. Этот файл — специфика проекта.

## Назначение
Тренажёр для подготовки к собеседованиям на **Data Analyst / Data Scientist**: задачи по блокам
(SQL, Статистика и A/B, Python, ML/DL), решение SQL-задач с автопроверкой прямо в браузере и
повторение теории по интервальным повторениям. Репозиторий **публичный** и работает как портфолио.

Что именно приложение делает — в [`PRD.md`](PRD.md). Журнал решений — в [`progress.md`](progress.md).

## Два вида данных — не путать
Ключевой принцип всего проекта:

| | Контент | Персональные данные |
|---|---|---|
| Что | задачи, теория, карточки, датасеты | попытки, прогресс, SRS, личные заметки |
| Где источник правды | `content/**/*.md` в git | только PostgreSQL |
| Как попадает в БД | `python -m tools sync` (upsert по slug) | пишет приложение |
| Можно ли снести БД | да, пересобирается из `content/` за секунды | нет, это личная история |
| Видно в публичном репо | да, это и есть портфолио | никогда |

Отсюда правило: **приложение никогда не пишет в контентные таблицы**, а `sync` никогда не трогает
персональные.

## Стек
- **Backend:** Python 3.12+, **FastAPI**, SQLAlchemy 2.x, **Alembic**, pydantic-settings,
  `psycopg` 3. Окружение — **uv**.
- **Frontend:** React 19 + **TypeScript** (`strict: true`), **Vite**, **Tailwind CSS 4**, pnpm.
- **БД:** **PostgreSQL 16** локально (docker-compose, порт **5433**).
- **SQL-раннер:** **PGlite** (`@electric-sql/pglite`) — настоящий Postgres в WASM, целиком в
  браузере. Бэкенд в проверке решений не участвует.
- **Auth:** нет — приложение однопользовательское и локальное.

## Слои backend
Строгая слоистость — бизнес-логика не импортирует FastAPI, весь SQL в data-слое:
```
API (app/api)  →  services (бизнес-логика, без импорта FastAPI)  →  repositories (весь SQL)  →  PostgreSQL
```
- `app/api/` — роутеры, зависимости в `api/deps.py`.
- `app/services/` — бизнес-логика (SM-2, статистика); **не импортирует FastAPI**.
- `app/repositories/` — **весь SQL здесь**; inline-SQL в роутерах запрещён.
- `app/schemas/` — pydantic-DTO.
- `app/db/` — `base.py`, `session.py`, `models/`.
- `app/core/` — `config.py` (pydantic-settings).
- `app/migrations/` — Alembic.

## Контент-тулинг
`backend/tools/` — CLI для работы с `content/`. Живёт внутри backend намеренно: переиспользует
его ORM-модели, настройки и сессию, не дублируя зависимости. Единый вход — `python -m tools`:

```bash
cd backend
uv run python -m tools new-task sql "Retention D7 по когортам"   # создать .md по шаблону
uv run python -m tools new-note sql "Оконные функции"            # конспект теории
uv run python -m tools validate                                  # схема + прогон эталонных SQL
uv run python -m tools sync                                      # upsert контента в БД
uv run python -m tools export-static                             # content.json для демо на Pages
```

`validate` не просто проверяет frontmatter — он **выполняет каждое эталонное SQL-решение на живом
Postgres** поверх его датасета. Опечатка в решении или разъехавшийся датасет ловятся сразу, а не
через месяц при повторении.

## Формат контента
Задача — `.md` с frontmatter, разделы `## Условие` / `## Решение` / `## Разбор`. Конспект теории —
`.md`, где карточки для SRS лежат прямо в тексте в разделе `## Карточки` (`### Q: вопрос` + ответ).
Датасет — обычный `.sql` (DDL + INSERT), один датасет обслуживает 5–15 задач.

Единственное место правды о формате — pydantic-модели в `backend/tools/schema.py`. Меняешь формат —
меняешь их, остальное подстраивается.

## Два источника данных на фронте
Приложение работает локально с FastAPI, а на GitHub Pages — как статичное read-only демо. Чтобы не
писать UI дважды, все компоненты ходят за данными через интерфейс `DataSource`
(`frontend/src/data/source.ts`) с двумя реализациями:

- `ApiDataSource` — локальный полный режим (`VITE_DATA_SOURCE=api`, по умолчанию);
- `StaticDataSource` — демо: контент из `content.json`, прогресс и SRS в `localStorage`.

**Компоненты не должны импортировать `fetch` или знать про API напрямую** — только `useDataSource()`.
SQL-раннер работает одинаково в обоих режимах, он целиком в браузере.

## Проверка SQL-решений
Ожидаемый результат нигде не хранится: при запуске выполняются и запрос пользователя, и эталонный
SQL из задачи — на одном датасете. Поэтому правка датасета не ломает задачи. Сравнение настраивается
блоком `check` во frontmatter (`ordered`, `tolerance`, `ignore_column_names`).

## Запуск
```bash
# 1. БД:
docker compose up -d db

# 2. Backend:
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m tools sync                    # залить контент в БД
uv run uvicorn app.main:app --reload           # http://localhost:8000/docs

# 3. Frontend:
cd frontend
pnpm install
pnpm dev                                       # http://localhost:5173
```

## Тестирование
- `pytest`, тесты в `backend/tests/`. Логику из `services/` (SM-2, сравнение результатов) тестируем
  изолированно — она не импортирует FastAPI.
- Прогон: `cd backend && uv run pytest`.
- Фронт: `cd frontend && pnpm typecheck`.

## Definition of Done (фича)
- [ ] Поведение соответствует записи в [`PRD.md`](PRD.md), включая edge cases.
- [ ] Слои соблюдены: SQL в `repositories/`, логика в `services/` без импорта FastAPI, DTO в `schemas/`.
- [ ] Изменения схемы — Alembic-миграцией; `alembic upgrade head` проходит чисто.
- [ ] Новый контент проходит `python -m tools validate`.
- [ ] Есть тесты на бизнес-логику; `uv run pytest` зелёный.
- [ ] `pnpm typecheck` без ошибок; UI использует только токены тем, без захардкоженных hex.
- [ ] Секреты только через окружение.
- [ ] Обновлены [`README.md`](README.md) (статус) и [`progress.md`](progress.md) (решение).

## Документация репо
- **CLAUDE.md** (этот файл) — конвенции и архитектурный контекст.
- **PRD.md** — что разрабатывается: поведение, acceptance criteria, edge cases.
- **README.md** — онбординг + актуальный статус.
- **progress.md** — журнал решений и открытых вопросов.
