/**
 * Календарь занятий за квартал: неделя — колонка, день — ячейка.
 *
 * Форма выбрана под задачу «виден ли режим»: важна не точная величина в конкретный день,
 * а плотность и пропуски. Цвет — sequential-шкала в один тон (пять ступеней из index.css),
 * поэтому интенсивность читается порядком, а не набором разных оттенков.
 */

import type { ActivityDay } from '../../data/types'

const WEEKDAY_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс']
const MONTH_NAMES = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const LEVEL_CLASSES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const

/** Ступень шкалы по числу действий за день. Пороги подобраны под реальную сессию: 1-2 задачи или десяток карточек. */
function level(total: number): number {
  if (total === 0) return 0
  if (total <= 2) return 1
  if (total <= 5) return 2
  if (total <= 10) return 3
  return 4
}

function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

/** Понедельник = 0, воскресенье = 6: неделя в русском календаре начинается с понедельника. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function ActivityCalendar({ days }: { days: ActivityDay[] }) {
  if (days.length === 0) return null

  // Добиваем начало пустыми ячейками, чтобы первая колонка начиналась с понедельника.
  const firstDate = parseDay(days[0]!.day)
  const leading = weekdayIndex(firstDate)
  const cells: (ActivityDay | null)[] = [...Array<null>(leading).fill(null), ...days]

  const weeks: (ActivityDay | null)[][] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }

  // Подпись месяца ставим у той недели, где месяц начинается.
  const monthLabels = weeks.map((week, index) => {
    const firstOfWeek = week.find((cell): cell is ActivityDay => cell !== null)
    if (!firstOfWeek) return ''
    const date = parseDay(firstOfWeek.day)
    const previous = weeks[index - 1]?.find((cell): cell is ActivityDay => cell !== null)
    const previousMonth = previous ? parseDay(previous.day).getMonth() : -1
    return date.getMonth() !== previousMonth ? (MONTH_NAMES[date.getMonth()] ?? '') : ''
  })

  const activeDays = days.filter((day) => day.attempts + day.reviews > 0).length
  const totalActions = days.reduce((sum, day) => sum + day.attempts + day.reviews, 0)

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1">
          {/* Подписи дней недели слева */}
          <div className="mt-5 flex flex-col gap-1">
            {WEEKDAY_LABELS.map((label, index) => (
              <span
                key={index}
                className="h-3 text-[10px] leading-3 text-muted"
                style={{ width: '1.5rem' }}
              >
                {label}
              </span>
            ))}
          </div>

          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              <span className="h-4 text-[10px] leading-4 text-muted">{monthLabels[weekIndex]}</span>
              {week.map((cell, dayIndex) => {
                if (!cell) return <span key={dayIndex} className="h-3 w-3" />
                const total = cell.attempts + cell.reviews
                const parts = [
                  cell.attempts ? `попыток: ${cell.attempts}` : '',
                  cell.reviews ? `повторений: ${cell.reviews}` : '',
                ].filter(Boolean)
                return (
                  <span
                    key={dayIndex}
                    // Нативный tooltip: точные числа доступны по наведению, а не только цветом.
                    title={`${cell.day}${parts.length ? ' — ' + parts.join(', ') : ' — занятий не было'}`}
                    className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASSES[level(total)]}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>
          Активных дней: {activeDays} из {days.length} · всего действий: {totalActions}
        </span>
        <span className="flex items-center gap-1.5">
          меньше
          {LEVEL_CLASSES.map((className) => (
            <span key={className} className={`h-3 w-3 rounded-[3px] ${className}`} />
          ))}
          больше
        </span>
      </div>
    </div>
  )
}
