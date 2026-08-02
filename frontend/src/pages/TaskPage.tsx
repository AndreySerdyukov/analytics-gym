/** Страница задачи: условие и схема данных слева, рабочее место и разбор справа. */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { Button, Card, DifficultyBadge, ErrorBox, Loader, StatusBadge } from '../components/ui'
import { getDataSource } from '../data/source'
import type { Progress, TaskDetail } from '../data/types'
import { SOURCE_LABELS } from '../data/types'
import { useAsync } from '../data/useAsync'

// Редактор кода тянет за собой CodeMirror — грузим его только на странице задачи,
// чтобы дашборд и списки открывались мгновенно.
const SqlWorkbench = lazy(() =>
  import('../features/sql-runner/SqlWorkbench').then((module) => ({
    default: module.SqlWorkbench,
  })),
)

export function TaskPage({ onProgressChange }: { onProgressChange: () => void }) {
  const { taskSlug = '' } = useParams()
  const task = useAsync((source) => source.getTask(taskSlug), [taskSlug])

  if (task.loading) return <Loader label="Загружаем задачу" />
  if (task.error) return <ErrorBox message={task.error} onRetry={task.reload} />
  if (!task.data) return null

  return <TaskView task={task.data} onProgressChange={onProgressChange} />
}

function TaskView({ task, onProgressChange }: { task: TaskDetail; onProgressChange: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const status = progress?.status ?? task.status

  const handleProgress = useCallback(
    (next: Progress) => {
      setProgress(next)
      // Дашборд и счётчики блоков должны увидеть новый статус.
      onProgressChange()
    },
    [onProgressChange],
  )

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/b/${task.block_slug}`} className="text-sm text-muted hover:text-text">
          ← к списку задач
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{task.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge value={status} />
            <DifficultyBadge value={task.difficulty} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-alt px-2.5 py-1">
              {tag}
            </span>
          ))}
          {task.company && <span>· {task.company}</span>}
          {task.source && <span>· {SOURCE_LABELS[task.source]}</span>}
          {task.estimated_minutes && <span>· ~{task.estimated_minutes} мин</span>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <Markdown>{task.statement_md}</Markdown>
          </Card>

          {task.dataset && (
            <details className="rounded-card border border-border bg-surface p-5">
              <summary className="cursor-pointer font-semibold">
                Схема данных: {task.dataset.title}
              </summary>
              {task.dataset.er_description && (
                <p className="mt-2 text-sm text-muted">{task.dataset.er_description}</p>
              )}
              <Markdown className="mt-3">
                {'```sql\n' + task.dataset.schema_sql + '\n```'}
              </Markdown>
            </details>
          )}

          <SolutionSection task={task} />
          <NoteSection task={task} onProgress={handleProgress} />
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Suspense fallback={<Loader label="Готовим редактор" />}>
            <SqlWorkbench task={task} onProgress={handleProgress} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/** Решение и разбор скрыты по умолчанию: подсмотреть можно, но только осознанно. */
function SolutionSection({ task }: { task: TaskDetail }) {
  const [revealed, setRevealed] = useState(false)

  if (!task.solution_md && !task.explanation_md) return null

  if (!revealed) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Решение и разбор</p>
          <p className="text-sm text-muted">Открывай, когда попробовал сам</p>
        </div>
        <Button variant="ghost" onClick={() => setRevealed(true)}>
          Показать
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {task.solution_md && (
        <Card>
          <h2 className="mb-2 text-lg font-bold">Решение</h2>
          <Markdown>{task.solution_md}</Markdown>
        </Card>
      )}
      {task.explanation_md && (
        <Card>
          <h2 className="mb-2 text-lg font-bold">Разбор</h2>
          <Markdown>{task.explanation_md}</Markdown>
        </Card>
      )}
    </div>
  )
}

/** Личная заметка «на чём погорел». Хранится в базе и не попадает в репозиторий. */
function NoteSection({ task, onProgress }: { task: TaskDetail; onProgress: (p: Progress) => void }) {
  const [note, setNote] = useState(task.personal_note_md ?? '')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done'>('idle')

  useEffect(() => {
    setNote(task.personal_note_md ?? '')
  }, [task.personal_note_md])

  const save = async () => {
    setSaved('saving')
    const source = await getDataSource()
    const progress = await source.saveNote(task.slug, note.trim() || null)
    onProgress(progress)
    setSaved('done')
  }

  return (
    <Card>
      <h2 className="mb-2 text-lg font-bold">Заметка</h2>
      <textarea
        value={note}
        onChange={(event) => {
          setNote(event.target.value)
          setSaved('idle')
        }}
        rows={3}
        placeholder="Что не понял, на чём споткнулся, что повторить"
        className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="ghost" onClick={() => void save()} disabled={saved === 'saving'}>
          {saved === 'saving' ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        {saved === 'done' && <span className="text-xs text-success">Сохранено</span>}
      </div>
    </Card>
  )
}
