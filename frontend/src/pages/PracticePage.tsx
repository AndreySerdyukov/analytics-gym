/** Практика блока: список задач с фильтрами по теме, сложности, тегам, статусу и поиском. */

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, DifficultyBadge, EmptyState, ErrorBox, Loader, StatusBadge, Tag } from '../components/ui'
import type { Block, Difficulty, TaskStatus } from '../data/types'
import { DIFFICULTY_LABELS, SOURCE_LABELS, STATUS_LABELS } from '../data/types'
import { useAsync } from '../data/useAsync'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const STATUSES: TaskStatus[] = ['new', 'in_progress', 'solved', 'failed']
const TAGS_PREVIEW_COUNT = 8

export function PracticePage({ blocks }: { blocks: Block[] }) {
  const { blockSlug = '' } = useParams()
  const block = blocks.find((item) => item.slug === blockSlug)

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [status, setStatus] = useState<TaskStatus | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [allTagsShown, setAllTagsShown] = useState(false)

  const tasks = useAsync(
    (source) =>
      source.listTasks({
        block: blockSlug,
        ...(difficulty ? { difficulty } : {}),
        ...(status ? { status } : {}),
        ...(tags.length ? { tags } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      }),
    [blockSlug, difficulty, status, tags.join(','), search],
  )
  const filters = useAsync((source) => source.getFilterOptions(blockSlug), [blockSlug])

  // Тема фильтруется на клиенте: она уже есть в каждой задаче, лишний запрос не нужен.
  const visible = useMemo(
    () => (tasks.data ?? []).filter((task) => !topic || task.topic_slug === topic),
    [tasks.data, topic],
  )

  // Выбранные теги показываем всегда, иначе активный фильтр мог бы спрятаться под «ещё N».
  const allTags = filters.data?.tags ?? []
  const visibleTags = allTagsShown
    ? allTags
    : [...new Set([...tags, ...allTags.slice(0, TAGS_PREVIEW_COUNT)])]
  const hiddenTagsCount = allTags.length - visibleTags.length

  if (!block) return <EmptyState title="Такого блока нет" hint="Выбери блок в шапке" />

  const solvedLabel = `Решено ${block.tasks_solved} из ${block.tasks_total}`

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    )

  const resetAll = () => {
    setDifficulty(null)
    setStatus(null)
    setTopic(null)
    setTags([])
    setSearch('')
    setAllTagsShown(false)
  }

  const hasFilters = Boolean(difficulty || status || topic || tags.length || search)

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/b/${block.slug}`} className="text-sm text-muted hover:text-text">
          ← {block.title}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold">Практика</h1>
        <p className="mt-1 text-muted">{solvedLabel}</p>
      </div>

      <Card className="space-y-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по названию и условию"
          className="w-full rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm outline-none focus:border-accent"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-muted">Сложность</span>
          {DIFFICULTIES.map((value) => (
            <Tag
              key={value}
              active={difficulty === value}
              onClick={() => setDifficulty(difficulty === value ? null : value)}
            >
              {DIFFICULTY_LABELS[value]}
            </Tag>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-muted">Статус</span>
          {STATUSES.map((value) => (
            <Tag
              key={value}
              active={status === value}
              onClick={() => setStatus(status === value ? null : value)}
            >
              {STATUS_LABELS[value]}
            </Tag>
          ))}
        </div>

        {block.topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-muted">Тема</span>
            {block.topics.map((item) => (
              <Tag
                key={item.slug}
                active={topic === item.slug}
                onClick={() => setTopic(topic === item.slug ? null : item.slug)}
              >
                {item.title}
              </Tag>
            ))}
          </div>
        )}

        {filters.data && filters.data.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-muted">Теги</span>
            {/* Тегов десятки: на телефоне полный список занимал бы пол-экрана до самих задач. */}
            {visibleTags.map((tag) => (
              <Tag key={tag} active={tags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag}
              </Tag>
            ))}
            {hiddenTagsCount > 0 && (
              <button
                type="button"
                onClick={() => setAllTagsShown(true)}
                className="rounded-full px-3 py-1 text-xs font-semibold text-accent-ink"
              >
                ещё {hiddenTagsCount}
              </button>
            )}
          </div>
        )}

        {hasFilters && (
          <button type="button" onClick={resetAll} className="text-xs font-semibold text-accent-ink underline">
            Сбросить фильтры
          </button>
        )}
      </Card>

      {tasks.loading && <Loader label="Загружаем задачи" />}
      {tasks.error && <ErrorBox message={tasks.error} onRetry={tasks.reload} />}

      {tasks.data && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Задач: {visible.length}</p>
          {visible.map((task) => (
            <Link key={task.slug} to={`/t/${task.slug}`}>
              <Card className="transition-colors hover:border-accent">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">{task.title}</h2>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge value={task.status} />
                    <DifficultyBadge value={task.difficulty} />
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {task.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-surface-alt px-2.5 py-1">
                      {tag}
                    </span>
                  ))}
                  {task.company && <span>· {task.company}</span>}
                  {task.source && <span>· {SOURCE_LABELS[task.source]}</span>}
                  {task.estimated_minutes && <span>· ~{task.estimated_minutes} мин</span>}
                </div>
              </Card>
            </Link>
          ))}
          {visible.length === 0 && (
            <EmptyState
              title="Ничего не найдено"
              hint={hasFilters ? 'Попробуй сбросить фильтры' : 'В этом блоке пока нет задач'}
            />
          )}
        </div>
      )}
    </div>
  )
}
