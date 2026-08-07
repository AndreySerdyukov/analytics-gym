/**
 * Единый интерфейс доступа к данным.
 *
 * Приложение работает в двух режимах: локально с FastAPI и как статичная витрина на GitHub
 * Pages. Чтобы не писать UI дважды, компоненты обращаются только сюда и не знают, откуда
 * пришли данные. Новый экран не должен импортировать fetch напрямую.
 */

import type {
  AttemptInput,
  Block,
  Card,
  FilterOptions,
  NoteDetail,
  NoteListItem,
  NoteProgress,
  Progress,
  Stats,
  ReviewState,
  ReviewSummary,
  TaskDetail,
  TaskFilters,
  TaskListItem,
  TaskStatus,
} from './types'

export interface DataSource {
  listBlocks(): Promise<Block[]>
  listTasks(filters: TaskFilters): Promise<TaskListItem[]>
  getTask(slug: string): Promise<TaskDetail>
  getFilterOptions(blockSlug?: string): Promise<FilterOptions>
  saveAttempt(slug: string, attempt: AttemptInput): Promise<Progress>
  saveNote(slug: string, noteMd: string | null): Promise<Progress>
  setStatus(slug: string, status: TaskStatus): Promise<Progress>

  // Повторение теории
  dueCards(blockSlug?: string, limit?: number): Promise<Card[]>
  gradeCard(slug: string, grade: number): Promise<ReviewState>
  reviewSummary(): Promise<ReviewSummary>
  listNotes(blockSlug?: string): Promise<NoteListItem[]>
  getNote(slug: string): Promise<NoteDetail>
  setNoteRead(slug: string, isRead: boolean): Promise<NoteProgress>

  /** Статистика по личной активности: прогресс, слабые темы, календарь занятий. */
  getStats(): Promise<Stats>

  /** Режим влияет на подписи в интерфейсе: в демо прогресс хранится только в браузере. */
  readonly kind: 'api' | 'static'
}

/** Значение подставляется на этапе сборки: 'api' для dev/build, 'static' для demo-билда. */
declare const __DATA_SOURCE__: 'api' | 'static'

let instance: DataSource | null = null

/** Возвращает источник данных, выбранный на этапе сборки. Инстанс один на всё приложение. */
export async function getDataSource(): Promise<DataSource> {
  if (instance) return instance

  if (__DATA_SOURCE__ === 'static') {
    const { StaticDataSource } = await import('./static-source')
    instance = new StaticDataSource()
  } else {
    const { ApiDataSource } = await import('./api-source')
    instance = new ApiDataSource()
  }
  return instance
}
