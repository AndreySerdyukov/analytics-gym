/**
 * Источник данных для публичного демо на GitHub Pages.
 *
 * Контент читается из content.json (его собирает `python -m tools export-static`),
 * а прогресс живёт в localStorage браузера посетителя. Личные заметки в демо не публикуются:
 * они есть только в базе локального режима.
 */

import type { DataSource } from './source'
import type {
  AttemptInput,
  Block,
  FilterOptions,
  Progress,
  TaskDetail,
  TaskFilters,
  TaskListItem,
  TaskStatus,
} from './types'

const PROGRESS_KEY = 'gym-progress'

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

interface RawContent {
  blocks: Omit<Block, 'tasks_total' | 'tasks_solved'>[]
  datasets: NonNullable<TaskDetail['dataset']>[]
  tasks: RawTask[]
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
}
