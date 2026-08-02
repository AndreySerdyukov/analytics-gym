/**
 * Алгоритм интервальных повторений SM-2 для демо-режима.
 *
 * Это перенос `backend/app/services/srs.py` один в один: в статическом демо бэкенда нет,
 * а режим повторения работать должен. Тест-кейсы у двух реализаций общие
 * (`srs.test.ts` и `tests/test_srs.py`) — меняешь одну, синхронизируй вторую.
 */

export const GRADE_FORGOT = 0
export const GRADE_HARD = 3
export const GRADE_EASY = 5
export const GRADES = [GRADE_FORGOT, GRADE_HARD, GRADE_EASY] as const

export const MIN_EASE_FACTOR = 1.3
export const DEFAULT_EASE_FACTOR = 2.5

export interface ReviewOutcome {
  ease_factor: number
  interval_days: number
  repetitions: number
  /** Дата следующего показа в формате YYYY-MM-DD. */
  due_date: string
}

/** Дата в формате YYYY-MM-DD по местному времени (не UTC: «сегодня» должно совпадать с календарём). */
export function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() + days)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

/** Состояние карточки, которую ещё не показывали: она должна попасть в сегодняшнюю очередь. */
export function initialState(day: string = today()): ReviewOutcome {
  return {
    ease_factor: DEFAULT_EASE_FACTOR,
    interval_days: 0,
    repetitions: 0,
    due_date: day,
  }
}

/**
 * Пересчитывает состояние карточки по оценке.
 *
 * Оценка ниже 3 — провал: серия обнуляется, карточка возвращается завтра. Коэффициент
 * лёгкости при этом всё равно снижается, чтобы трудная карточка росла в интервалах медленнее.
 */
export function review(
  state: Pick<ReviewOutcome, 'ease_factor' | 'interval_days' | 'repetitions'>,
  grade: number,
  day: string = today(),
): ReviewOutcome {
  if (!GRADES.includes(grade as (typeof GRADES)[number])) {
    throw new Error(`Недопустимая оценка: ${grade}`)
  }

  const raw = state.ease_factor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
  const easeFactor = Math.max(MIN_EASE_FACTOR, Math.round(raw * 10000) / 10000)

  if (grade < GRADE_HARD) {
    return {
      ease_factor: easeFactor,
      interval_days: 1,
      repetitions: 0,
      due_date: addDays(day, 1),
    }
  }

  let interval: number
  if (state.repetitions === 0) interval = 1
  else if (state.repetitions === 1) interval = 6
  // Math.round в JS округляет .5 вверх, в Python — к чётному. На реальных значениях
  // ease factor попадание ровно в .5 практически исключено, но помнить об этом стоит.
  else interval = Math.max(1, Math.round(state.interval_days * easeFactor))

  return {
    ease_factor: easeFactor,
    interval_days: interval,
    repetitions: state.repetitions + 1,
    due_date: addDays(day, interval),
  }
}
