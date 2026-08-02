/**
 * Статистика: где я сейчас и на чём спотыкаюсь.
 *
 * Считается по фактам — попыткам и повторениям, а не по самооценке. Поэтому «слабые темы»
 * ранжируются по числу неудачных попыток, а не по количеству нерешённых задач.
 */

import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorBox, Loader } from '../components/ui'
import { useAsync } from '../data/useAsync'
import { ActivityCalendar } from '../features/stats/ActivityCalendar'

/** Склонение «день / дня / дней» — счётчик серии мозолит глаза, ошибка была бы заметной. */
function pluralDays(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds} с`
  return `${Math.round(seconds / 60)} мин`
}

function StatTile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <Card className="py-4">
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  )
}

export function StatsPage() {
  const stats = useAsync((source) => source.getStats(), [])

  if (stats.loading) return <Loader label="Считаем статистику" />
  if (stats.error) return <ErrorBox message={stats.error} onRetry={stats.reload} />
  if (!stats.data) return null

  const { totals, by_block, weak_tags, activity, streak_days } = stats.data
  const accuracy =
    totals.attempts_total > 0
      ? Math.round((totals.attempts_correct / totals.attempts_total) * 100)
      : null
  const maxFailed = Math.max(1, ...weak_tags.map((tag) => tag.failed_attempts))
  const hasSpread = maxFailed > 1
  const nothingYet = totals.attempts_total === 0 && totals.cards_learned === 0

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">Статистика</h1>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          value={`${totals.tasks_solved}/${totals.tasks_total}`}
          label="Задач решено"
        />
        <StatTile
          value={accuracy === null ? '—' : `${accuracy}%`}
          label="Точность попыток"
          hint={`${totals.attempts_correct} верных из ${totals.attempts_total}`}
        />
        <StatTile
          value={`${totals.cards_learned}/${totals.cards_total}`}
          label="Карточек закреплено"
          hint="от трёх успешных повторений подряд"
        />
        <StatTile
          value={String(streak_days)}
          label={`${pluralDays(streak_days)} подряд`}
          hint="серия занятий"
        />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Календарь занятий</h2>
        <Card>
          <ActivityCalendar days={activity} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Прогресс по блокам</h2>
        <Card className="space-y-4">
          {by_block.map((block) => {
            const percent =
              block.tasks_total > 0 ? Math.round((block.tasks_solved / block.tasks_total) * 100) : 0
            return (
              <div key={block.block_slug}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <Link to={`/b/${block.block_slug}`} className="font-semibold hover:underline">
                    {block.title}
                  </Link>
                  <span className="text-muted">
                    {block.tasks_solved} из {block.tasks_total}
                    {block.attempts > 0 && ` · попыток: ${block.attempts}`}
                    {block.avg_solve_seconds && ` · в среднем ${formatDuration(block.avg_solve_seconds)}`}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Где спотыкаюсь</h2>
        {nothingYet ? (
          <EmptyState
            title="Пока не на чем считать"
            hint="Реши несколько задач — здесь появятся темы с наибольшим числом неудачных попыток"
          />
        ) : (
          <Card className="space-y-3">
            {/*
              Полосы рисуем только когда есть что сравнивать. Если у всех тем по одной
              неудаче, одинаковые полосы во всю ширину не несут информации и создают
              ложное ощущение провала — в этом случае достаточно чисел.
            */}
            {weak_tags.map((tag) => (
              <div key={tag.tag} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 truncate font-medium" title={tag.tag}>
                  {tag.tag}
                </span>
                {hasSpread && (
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className="h-full rounded-full bg-danger"
                      style={{ width: `${(tag.failed_attempts / maxFailed) * 100}%` }}
                    />
                  </div>
                )}
                <span
                  className={`shrink-0 text-xs whitespace-nowrap text-muted ${
                    hasSpread ? 'w-44 text-right' : 'flex-1'
                  }`}
                  title={`Неудачных попыток: ${tag.failed_attempts}. Решено задач: ${tag.tasks_solved} из ${tag.tasks_total}`}
                >
                  неудач: {tag.failed_attempts} · решено {tag.tasks_solved}/{tag.tasks_total}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
