/**
 * Источник данных для публичного демо на GitHub Pages.
 *
 * Контент читается из content.json (его собирает `python -m tools export-static`),
 * а прогресс живёт в localStorage браузера посетителя. Личные заметки в демо не публикуются:
 * они есть только в базе локального режима.
 */

import type { DataSource } from './source'
import { initialState, review, today } from './srs'
import type {
  ActivityDay,
  AttemptInput,
  Block,
  Card,
  FilterOptions,
  NoteDetail,
  NoteListItem,
  Progress,
  ReviewState,
  ReviewSummary,
  Stats,
  TaskDetail,
  TaskFilters,
  TaskListItem,
  TaskStatus,
} from './types'

const PROGRESS_KEY = 'gym-progress'
const REVIEW_KEY = 'gym-review'
const ACTIVITY_KEY = 'gym-activity'

/** Календарь занятий показывает примерно квартал — как и в локальном режиме. */
const ACTIVITY_DAYS = 91

/**
 * Журнал активности по дням. В локальном режиме его заменяет таблица попыток, но в демо
 * истории нет вообще — а календарь занятий и серия дней без неё не строятся. Поэтому
 * храним минимум: сколько попыток и повторений пришлось на каждый день.
 */
interface ActivityEntry {
  attempts: number
  reviews: number
  correct: number
}

function loadActivity(): Record<string, ActivityEntry> {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ActivityEntry>) : {}
  } catch {
    return {}
  }
}

function recordActivity(kind: 'attempt' | 'review', isCorrect = false): void {
  try {
    const log = loadActivity()
    const day = today()
    const entry = log[day] ?? { attempts: 0, reviews: 0, correct: 0 }
    if (kind === 'attempt') {
      entry.attempts += 1
      if (isCorrect) entry.correct += 1
    } else {
      entry.reviews += 1
    }
    log[day] = entry
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log))
  } catch {
    // Приватный режим: статистика просто не накопится.
  }
}

interface RawTask {
  slug: string
  title: string
  block_slug: string
  topic_slug: string | null
  difficulty: TaskListItem['difficulty']
  tags: string[]
  source: TaskListItem['source']
  company: string | null
  estimated_minutes: number | null
  statement_md: string
  solution_md: string | null
  explanation_md: string | null
  solution_sql: string | null
  check_config: TaskDetail['check_config']
  dataset_slug: string | null
  position: number
}

interface RawNote {
  slug: string
  title: string
  block_slug: string
  topic_slug: string | null
  tags: string[]
  body_md: string
  position: number
}

interface RawCard {
  slug: string
  block_slug: string
  note_slug: string
  question_md: string
  answer_md: string
  position: number
}

interface RawContent {
  blocks: Omit<Block, 'tasks_total' | 'tasks_solved'>[]
  datasets: NonNullable<TaskDetail['dataset']>[]
  tasks: RawTask[]
  notes: RawNote[]
  cards: RawCard[]
}

const EMPTY_PROGRESS: Progress = {
  status: 'new',
  attempts_count: 0,
  first_solved_at: null,
  last_attempt_at: null,
  personal_note_md: null,
}

function loadProgressMap(): Record<string, Progress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Progress>) : {}
  } catch {
    // Повреждённый или недоступный localStorage не должен ронять приложение.
    return {}
  }
}

function saveProgressMap(map: Record<string, Progress>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
  } catch {
    // Приватный режим браузера: прогресс просто не сохранится.
  }
}

function loadReviewMap(): Record<string, ReviewState> {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ReviewState>) : {}
  } catch {
    return {}
  }
}

function saveReviewMap(map: Record<string, ReviewState>): void {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(map))
  } catch {
    // Приватный режим браузера: повторения не сохранятся.
  }
}

export class StaticDataSource implements DataSource {
  readonly kind = 'static' as const
  private content: Promise<RawContent> | null = null

  private load(): Promise<RawContent> {
    if (!this.content) {
      this.content = fetch(`${import.meta.env.BASE_URL}content.json`).then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить контент демо (content.json)')
        return response.json() as Promise<RawContent>
      })
    }
    return this.content
  }

  private progressOf(slug: string): Progress {
    return loadProgressMap()[slug] ?? EMPTY_PROGRESS
  }

  private toListItem(task: RawTask): TaskListItem {
    const progress = this.progressOf(task.slug)
    return {
      slug: task.slug,
      title: task.title,
      block_slug: task.block_slug,
      topic_slug: task.topic_slug,
      difficulty: task.difficulty,
      tags: task.tags,
      source: task.source,
      company: task.company,
      estimated_minutes: task.estimated_minutes,
      status: progress.status,
      attempts_count: progress.attempts_count,
    }
  }

  async listBlocks(): Promise<Block[]> {
    const content = await this.load()
    const progress = loadProgressMap()

    return content.blocks.map((block) => {
      const tasks = content.tasks.filter((task) => task.block_slug === block.slug)
      const solved = tasks.filter((task) => progress[task.slug]?.status === 'solved').length
      return { ...block, tasks_total: tasks.length, tasks_solved: solved }
    })
  }

  async listTasks(filters: TaskFilters): Promise<TaskListItem[]> {
    const content = await this.load()
    const search = filters.search?.toLowerCase()

    return content.tasks
      .filter((task) => !filters.block || task.block_slug === filters.block)
      .filter((task) => !filters.difficulty || task.difficulty === filters.difficulty)
      .filter((task) => !filters.company || task.company === filters.company)
      .filter((task) => (filters.tags ?? []).every((tag) => task.tags.includes(tag)))
      .filter(
        (task) =>
          !search ||
          task.title.toLowerCase().includes(search) ||
          task.statement_md.toLowerCase().includes(search),
      )
      .map((task) => this.toListItem(task))
      .filter((task) => !filters.status || task.status === filters.status)
      .sort((a, b) => a.slug.localeCompare(b.slug))
  }

  async getTask(slug: string): Promise<TaskDetail> {
    const content = await this.load()
    const task = content.tasks.find((candidate) => candidate.slug === slug)
    if (!task) throw new Error(`Задача не найдена: ${slug}`)

    const dataset = task.dataset_slug
      ? (content.datasets.find((item) => item.slug === task.dataset_slug) ?? null)
      : null

    return {
      ...this.toListItem(task),
      statement_md: task.statement_md,
      solution_md: task.solution_md,
      explanation_md: task.explanation_md,
      solution_sql: task.solution_sql,
      check_config: task.check_config,
      dataset,
      personal_note_md: this.progressOf(slug).personal_note_md,
    }
  }

  async getFilterOptions(blockSlug?: string): Promise<FilterOptions> {
    const content = await this.load()
    const tasks = content.tasks.filter((task) => !blockSlug || task.block_slug === blockSlug)
    return {
      tags: [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b)),
      companies: [
        ...new Set(
          content.tasks
            .map((task) => task.company)
            .filter((company): company is string => Boolean(company)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    }
  }

  async saveAttempt(slug: string, attempt: AttemptInput): Promise<Progress> {
    const map = loadProgressMap()
    const current = map[slug] ?? EMPTY_PROGRESS
    const now = new Date().toISOString()

    // Правила статусов те же, что на бэкенде: из solved обратно не откатываемся.
    const next: Progress = {
      status: attempt.is_correct ? 'solved' : current.status === 'new' ? 'in_progress' : current.status,
      attempts_count: current.attempts_count + 1,
      first_solved_at:
        attempt.is_correct && !current.first_solved_at ? now : current.first_solved_at,
      last_attempt_at: now,
      personal_note_md: current.personal_note_md,
    }

    map[slug] = next
    saveProgressMap(map)
    recordActivity('attempt', attempt.is_correct)
    return next
  }

  async saveNote(slug: string, noteMd: string | null): Promise<Progress> {
    const map = loadProgressMap()
    const next: Progress = { ...(map[slug] ?? EMPTY_PROGRESS), personal_note_md: noteMd }
    map[slug] = next
    saveProgressMap(map)
    return next
  }

  async setStatus(slug: string, status: TaskStatus): Promise<Progress> {
    const map = loadProgressMap()
    const next: Progress = { ...(map[slug] ?? EMPTY_PROGRESS), status }
    map[slug] = next
    saveProgressMap(map)
    return next
  }

  async dueCards(blockSlug?: string, limit = 20): Promise<Card[]> {
    const content = await this.load()
    const states = loadReviewMap()
    const currentDay = today()
    const notesBySlug = new Map(content.notes.map((note) => [note.slug, note]))

    return content.cards
      .filter((card) => !blockSlug || card.block_slug === blockSlug)
      .map((card) => ({ card, state: states[card.slug] }))
      // Карточка без состояния — новая, её показываем сегодня.
      .filter(({ state }) => !state || state.due_date <= currentDay)
      // Сначала самые просроченные, новые идут следом.
      .sort((a, b) => (a.state?.due_date ?? currentDay).localeCompare(b.state?.due_date ?? currentDay))
      .slice(0, limit)
      .map(({ card, state }) => ({
        slug: card.slug,
        block_slug: card.block_slug,
        note_title: notesBySlug.get(card.note_slug)?.title ?? null,
        question_md: card.question_md,
        answer_md: card.answer_md,
        repetitions: state?.repetitions ?? 0,
        due_date: state?.due_date ?? null,
      }))
  }

  async gradeCard(slug: string, grade: number): Promise<ReviewState> {
    const states = loadReviewMap()
    const current = states[slug] ?? initialState()
    const next = review(current, grade)
    states[slug] = next
    saveReviewMap(states)
    recordActivity('review')
    return next
  }

  async reviewSummary(): Promise<ReviewSummary> {
    const content = await this.load()
    const states = loadReviewMap()
    const currentDay = today()
    const due = content.cards.filter((card) => {
      const state = states[card.slug]
      return !state || state.due_date <= currentDay
    })
    return { due_today: due.length, cards_total: content.cards.length }
  }

  async listNotes(blockSlug?: string): Promise<NoteListItem[]> {
    const content = await this.load()
    return content.notes
      .filter((note) => !blockSlug || note.block_slug === blockSlug)
      .map((note) => ({
        slug: note.slug,
        block_slug: note.block_slug,
        title: note.title,
        tags: note.tags,
        cards_count: content.cards.filter((card) => card.note_slug === note.slug).length,
      }))
  }

  async getNote(slug: string): Promise<NoteDetail> {
    const content = await this.load()
    const note = content.notes.find((candidate) => candidate.slug === slug)
    if (!note) throw new Error(`Конспект не найден: ${slug}`)
    return {
      slug: note.slug,
      block_slug: note.block_slug,
      title: note.title,
      tags: note.tags,
      cards_count: content.cards.filter((card) => card.note_slug === note.slug).length,
      body_md: note.body_md,
    }
  }

  async getStats(): Promise<Stats> {
    const content = await this.load()
    const progress = loadProgressMap()
    const reviews = loadReviewMap()
    const log = loadActivity()

    const solvedSlugs = new Set(
      Object.entries(progress)
        .filter(([, value]) => value.status === 'solved')
        .map(([slug]) => slug),
    )
    const attemptsTotal = Object.values(log).reduce((sum, entry) => sum + entry.attempts, 0)
    const attemptsCorrect = Object.values(log).reduce((sum, entry) => sum + entry.correct, 0)

    const activity: ActivityDay[] = []
    const activeDays = new Set<string>()
    for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
      const day = shiftDays(today(), -offset)
      const entry = log[day] ?? { attempts: 0, reviews: 0, correct: 0 }
      activity.push({ day, attempts: entry.attempts, reviews: entry.reviews })
      if (entry.attempts || entry.reviews) activeDays.add(day)
    }

    // Слабые темы: в демо истории неудач нет, поэтому ранжируем по нерешённым задачам тега.
    const tagStats = new Map<string, { total: number; solved: number }>()
    for (const task of content.tasks) {
      for (const tag of task.tags) {
        const current = tagStats.get(tag) ?? { total: 0, solved: 0 }
        current.total += 1
        if (solvedSlugs.has(task.slug)) current.solved += 1
        tagStats.set(tag, current)
      }
    }

    return {
      totals: {
        tasks_total: content.tasks.length,
        tasks_solved: solvedSlugs.size,
        attempts_total: attemptsTotal,
        attempts_correct: attemptsCorrect,
        cards_total: content.cards.length,
        cards_learned: Object.values(reviews).filter((state) => state.repetitions >= 3).length,
      },
      by_block: content.blocks.map((block) => {
        const tasks = content.tasks.filter((task) => task.block_slug === block.slug)
        return {
          block_slug: block.slug,
          title: block.title,
          tasks_total: tasks.length,
          tasks_solved: tasks.filter((task) => solvedSlugs.has(task.slug)).length,
          attempts: tasks.reduce((sum, task) => sum + (progress[task.slug]?.attempts_count ?? 0), 0),
          avg_solve_seconds: null,
        }
      }),
      weak_tags: [...tagStats.entries()]
        .map(([tag, value]) => ({
          tag,
          tasks_total: value.total,
          tasks_solved: value.solved,
          failed_attempts: value.total - value.solved,
        }))
        .sort((a, b) => b.failed_attempts - a.failed_attempts || a.tag.localeCompare(b.tag))
        .slice(0, 12),
      activity,
      streak_days: currentStreak(activeDays, today()),
    }
  }
}

/** Сдвиг даты в формате YYYY-MM-DD на указанное число дней. */
function shiftDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() + days)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

/**
 * Серия занятий подряд. Правило то же, что на бэкенде: сегодняшний день без активности
 * серию не обрывает, потому что день ещё не закончился.
 */
function currentStreak(activeDays: Set<string>, day: string): number {
  let cursor = activeDays.has(day) ? day : shiftDays(day, -1)
  let streak = 0
  while (activeDays.has(cursor)) {
    streak += 1
    cursor = shiftDays(cursor, -1)
  }
  return streak
}
