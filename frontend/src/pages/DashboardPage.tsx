/** Главная: блоки с прогрессом и последняя активность. */

import { Link } from 'react-router-dom'
import { Card, EmptyState, ProgressBar, StatusBadge } from '../components/ui'
import type { Block } from '../data/types'
import { useAsync } from '../data/useAsync'

export function DashboardPage({ blocks }: { blocks: Block[] }) {
  const inProgress = useAsync((source) => source.listTasks({ status: 'in_progress' }), [])
  const solvedTotal = blocks.reduce((sum, block) => sum + block.tasks_solved, 0)
  const tasksTotal = blocks.reduce((sum, block) => sum + block.tasks_total, 0)

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Тренировка перед собеседованием</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Задачи по блокам, SQL с проверкой прямо в браузере и повторение теории. Решено{' '}
          <span className="font-semibold whitespace-nowrap text-text">
            {solvedTotal} из {tasksTotal}
          </span>
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {blocks.map((block) => (
          <Link key={block.slug} to={`/b/${block.slug}`} className="group">
            <Card className="h-full transition-colors group-hover:border-accent">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {block.icon && <span className="mr-2">{block.icon}</span>}
                    {block.title}
                  </h2>
                  {block.description && (
                    <p className="mt-1 text-sm text-muted">{block.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-muted">
                  {block.tasks_solved}/{block.tasks_total}
                </span>
              </div>

              <div className="mt-4">
                <ProgressBar value={block.tasks_solved} total={block.tasks_total} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {block.topics.slice(0, 4).map((topic) => (
                  <span key={topic.slug} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-muted">
                    {topic.title}
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Незаконченное</h2>
        {inProgress.data && inProgress.data.length > 0 ? (
          <div className="space-y-2">
            {inProgress.data.map((task) => (
              <Link key={task.slug} to={`/t/${task.slug}`}>
                <Card className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:border-accent">
                  <span className="font-medium">{task.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    попыток: {task.attempts_count}
                    <StatusBadge value={task.status} />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Нет задач в работе"
            hint="Открой блок и начни решать — незаконченные появятся здесь"
          />
        )}
      </section>
    </div>
  )
}
