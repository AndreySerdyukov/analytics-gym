/** Доменные типы приложения. Общие для обоих источников данных: API и статического демо. */

export type Difficulty = 'easy' | 'medium' | 'hard'
export type TaskStatus = 'new' | 'in_progress' | 'solved' | 'failed'
export type TaskSource = 'interview' | 'course' | 'leetcode' | 'own'

export interface Topic {
  slug: string
  title: string
  sort_order: number
}

export interface Block {
  slug: string
  title: string
  description: string | null
  icon: string | null
  sort_order: number
  topics: Topic[]
  tasks_total: number
  tasks_solved: number
  /** Сводка по теории блока: приходит вместе с блоком, чтобы хабу не нужен был свой запрос. */
  notes_total: number
  notes_read: number
}

/** Данные для SQL-раннера: этот SQL накатывается в PGlite перед решением задачи. */
export interface Dataset {
  slug: string
  title: string
  schema_sql: string
  seed_sql: string
  er_description: string | null
}

/** Настройки сравнения результата с эталоном, заданные во frontmatter задачи. */
export interface CheckConfig {
  ordered: boolean
  tolerance: number
  ignore_column_names: boolean
  max_rows: number
}

export interface TaskListItem {
  slug: string
  title: string
  block_slug: string
  topic_slug: string | null
  difficulty: Difficulty
  tags: string[]
  source: TaskSource | null
  company: string | null
  estimated_minutes: number | null
  status: TaskStatus
  attempts_count: number
}

export interface TaskDetail extends TaskListItem {
  statement_md: string
  solution_md: string | null
  explanation_md: string | null
  solution_sql: string | null
  check_config: Partial<CheckConfig>
  dataset: Dataset | null
  personal_note_md: string | null
}

export interface Progress {
  status: TaskStatus
  attempts_count: number
  first_solved_at: string | null
  last_attempt_at: string | null
  personal_note_md: string | null
}

export interface AttemptInput {
  submitted_code: string
  is_correct: boolean
  duration_seconds: number | null
  error_text: string | null
}

export interface TaskFilters {
  block?: string
  difficulty?: Difficulty
  tags?: string[]
  status?: TaskStatus
  company?: string
  search?: string
}

export interface FilterOptions {
  tags: string[]
  companies: string[]
}

/** Карточка в режиме повторения. */
export interface Card {
  slug: string
  block_slug: string
  note_title: string | null
  question_md: string
  answer_md: string
  repetitions: number
  due_date: string | null
}

/** Состояние карточки после оценки — по нему показываем, когда она вернётся. */
export interface ReviewState {
  ease_factor: number
  interval_days: number
  repetitions: number
  due_date: string
}

export interface ReviewSummary {
  due_today: number
  cards_total: number
}

export interface NoteListItem {
  slug: string
  block_slug: string
  /** Тема из blocks.yaml: по ней конспекты группируются в боковом списке раздела теории. */
  topic_slug: string | null
  title: string
  tags: string[]
  cards_count: number
  is_read: boolean
}

export interface NoteDetail extends NoteListItem {
  body_md: string
}

/** Состояние конспекта после отметки о прочтении. */
export interface NoteProgress {
  slug: string
  is_read: boolean
  read_at: string | null
}

/** День в календаре занятий. */
export interface ActivityDay {
  day: string
  attempts: number
  reviews: number
}

export interface BlockStats {
  block_slug: string
  title: string
  tasks_total: number
  tasks_solved: number
  attempts: number
  avg_solve_seconds: number | null
}

export interface TagStats {
  tag: string
  tasks_total: number
  tasks_solved: number
  failed_attempts: number
}

export interface Stats {
  totals: {
    tasks_total: number
    tasks_solved: number
    attempts_total: number
    attempts_correct: number
    cards_total: number
    cards_learned: number
  }
  by_block: BlockStats[]
  weak_tags: TagStats[]
  activity: ActivityDay[]
  streak_days: number
}

export const DEFAULT_CHECK_CONFIG: CheckConfig = {
  ordered: false,
  tolerance: 0.001,
  ignore_column_names: true,
  max_rows: 200,
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'лёгкая',
  medium: 'средняя',
  hard: 'сложная',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'не начата',
  in_progress: 'в работе',
  solved: 'решена',
  failed: 'сдался',
}

export const SOURCE_LABELS: Record<TaskSource, string> = {
  interview: 'собеседование',
  course: 'курс',
  leetcode: 'LeetCode',
  own: 'своя',
}
