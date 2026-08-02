# analytics-gym

**Живое демо: https://andreyserdyukov.github.io/analytics-gym/**

Тренажёр для подготовки к собеседованиям на Data Analyst / Data Scientist: задачи по блокам,
SQL с автопроверкой прямо в браузере и повторение теории по интервальным повторениям.

- **SQL по-настоящему.** Задачи решаются в настоящем PostgreSQL, запущенном в браузере через
  [PGlite](https://pglite.dev). Запрос проверяется сравнением с эталоном на том же датасете,
  а не «посмотрел ответ – вроде понял».
- **Свои задачи без трения.** Задача — обычный Markdown-файл: создать шаблон командой, дописать
  в редакторе, залить в базу.
- **Повторение, а не перечитывание.** Карточки из конспектов теории показываются по алгоритму SM-2.
- **Блоки.** SQL, Статистика и A/B, Python, ML/DL. Новый блок добавляется правкой `content/blocks.yaml`.

## Стек

| Слой | Технологии |
|---|---|
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, psycopg 3, uv |
| Frontend | React 19, TypeScript strict, Vite, Tailwind CSS 4, pnpm |
| БД | PostgreSQL 16 (docker-compose, порт 5433) |
| SQL-раннер | PGlite — Postgres в WebAssembly, целиком в браузере |

## Быстрый старт

```bash
# 1. База — вариант А (Docker):
docker compose up -d db

# 1. База — вариант Б (локальный Postgres из brew, порт 5433):
LC_ALL=C pg_ctl -D /opt/homebrew/var/postgresql@16 -o "-p 5433" -l /tmp/pg5433.log start
createdb -p 5433 -O analytics_gym analytics_gym   # один раз, роль создаётся отдельно

# 2. Backend + контент
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m tools sync            # залить content/ в базу
uv run uvicorn app.main:app --reload   # http://localhost:8000/docs

# 3. Frontend
cd ../frontend
pnpm install
pnpm dev                               # http://localhost:5173
```

## Работа с контентом

```bash
cd backend
uv run python -m tools new-task sql "Retention D7 по когортам"  # создать задачу по шаблону
uv run python -m tools new-note sql "Оконные функции"           # создать конспект теории
uv run python -m tools validate                                 # проверить формат и прогнать эталонные SQL
uv run python -m tools sync                                     # обновить базу из content/
```

`validate` выполняет каждое эталонное решение на живом Postgres поверх его датасета — опечатка
в решении или разъехавшийся датасет обнаруживаются сразу.

## Структура

```
content/     задачи, теория, датасеты — источник правды, всё в git
backend/     FastAPI (api → services → repositories) + tools/ (CLI для content/)
frontend/    React; весь UI ходит за данными через интерфейс DataSource
```

Контент живёт в файлах, персональные данные (попытки, прогресс, повторения, заметки) — только в
базе и никогда не попадают в репозиторий.

## Документация

- [CLAUDE.md](CLAUDE.md) — архитектурный контекст и конвенции
- [PRD.md](PRD.md) — поведение фич и acceptance criteria
- [progress.md](progress.md) — журнал решений

## Проверки

```bash
cd backend  && uv run pytest          # логика статусов, парсер контента, health
cd frontend && pnpm test              # сравнение с эталоном + прогон всех задач в PGlite
cd frontend && pnpm typecheck         # строгий TypeScript
```

Тест `pglite.test.ts` накатывает настоящий датасет из `content/` в PGlite и выполняет каждое
эталонное решение. Так ловятся расхождения между «большим» Postgres, на котором работает
`validate`, и браузерным, в котором решает пользователь.

## Разделы

| Раздел | Что делает |
|---|---|
| Блоки | задачи с фильтрами по сложности, теме, тегам, статусу и поиском |
| Задача | условие, схема данных, редактор с автопроверкой, решение, разбор, личная заметка |
| Теория | конспекты; вопросы из них попадают в повторение |
| Повторение | карточки по алгоритму SM-2, оценка с клавиатуры |
| Статистика | прогресс по блокам, календарь занятий, серия дней, слабые темы |

## Статус

Работает end-to-end: каркас, контент-пайплайн, SQL-тренажёр с проверкой в PGlite,
интервальные повторения, статистика, CI и автодеплой демо на Pages. Наполнено 15 SQL-задач,
5 конспектов и 36 карточек.

Дальше: Python-раннер на Pyodide, задачи в блоки `stats-ab`, `python` и `ml`.
