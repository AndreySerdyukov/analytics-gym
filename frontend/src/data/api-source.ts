/** Источник данных для локального режима: всё через FastAPI. */

import type { DataSource } from './source'
import type {
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

const API_PREFIX = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    // Бэкенд отдаёт человекочитаемый detail — показываем его, а не «500».
    const detail = await response
      .json()
      .then((body: { detail?: string }) => body.detail)
      .catch(() => null)
    throw new Error(detail ?? `Запрос ${path} завершился с кодом ${response.status}`)
  }
  return response.json() as Promise<T>
}

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams()
  if (filters.block) params.set('block', filters.block)
  if (filters.difficulty) params.set('difficulty', filters.difficulty)
  if (filters.status) params.set('status', filters.status)
  if (filters.company) params.set('company', filters.company)
  if (filters.search) params.set('search', filters.search)
  // Теги повторяются: ?tag=window-functions&tag=cohort
  for (const tag of filters.tags ?? []) params.append('tag', tag)

  const query = params.toString()
  return query ? `?${query}` : ''
}

export class ApiDataSource implements DataSource {
  readonly kind = 'api' as const

  listBlocks(): Promise<Block[]> {
    return request<Block[]>('/blocks')
  }

  listTasks(filters: TaskFilters): Promise<TaskListItem[]> {
    return request<TaskListItem[]>(`/tasks${buildQuery(filters)}`)
  }

  getTask(slug: string): Promise<TaskDetail> {
    return request<TaskDetail>(`/tasks/${encodeURIComponent(slug)}`)
  }

  getFilterOptions(blockSlug?: string): Promise<FilterOptions> {
    const query = blockSlug ? `?block=${encodeURIComponent(blockSlug)}` : ''
    return request<FilterOptions>(`/blocks/filters${query}`)
  }

  async saveAttempt(slug: string, attempt: AttemptInput): Promise<Progress> {
    const result = await request<{ progress: Progress }>(
      `/tasks/${encodeURIComponent(slug)}/attempts`,
      { method: 'POST', body: JSON.stringify(attempt) },
    )
    return result.progress
  }

  saveNote(slug: string, noteMd: string | null): Promise<Progress> {
    return request<Progress>(`/tasks/${encodeURIComponent(slug)}/note`, {
      method: 'PUT',
      body: JSON.stringify({ personal_note_md: noteMd }),
    })
  }

  setStatus(slug: string, status: TaskStatus): Promise<Progress> {
    return request<Progress>(`/tasks/${encodeURIComponent(slug)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  dueCards(blockSlug?: string, limit = 20): Promise<Card[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (blockSlug) params.set('block', blockSlug)
    return request<Card[]>(`/review/due?${params}`)
  }

  gradeCard(slug: string, grade: number): Promise<ReviewState> {
    return request<ReviewState>(`/review/${encodeURIComponent(slug)}/grade`, {
      method: 'POST',
      body: JSON.stringify({ grade }),
    })
  }

  reviewSummary(): Promise<ReviewSummary> {
    return request<ReviewSummary>('/review/summary')
  }

  listNotes(blockSlug?: string): Promise<NoteListItem[]> {
    const query = blockSlug ? `?block=${encodeURIComponent(blockSlug)}` : ''
    return request<NoteListItem[]>(`/notes${query}`)
  }

  getNote(slug: string): Promise<NoteDetail> {
    return request<NoteDetail>(`/notes/${encodeURIComponent(slug)}`)
  }

  getStats(): Promise<Stats> {
    return request<Stats>('/stats')
  }
}
