/**
 * Те же кейсы, что в `backend/tests/test_srs.py`.
 * Реализации на Python и TypeScript должны вести себя одинаково, иначе прогресс повторений
 * в демо и в локальном режиме разойдётся.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EASE_FACTOR,
  GRADE_EASY,
  GRADE_FORGOT,
  GRADE_HARD,
  MIN_EASE_FACTOR,
  initialState,
  review,
} from './srs'

const TODAY = '2026-08-02'

describe('SM-2', () => {
  it('новая карточка показывается сегодня', () => {
    const state = initialState(TODAY)
    expect(state.due_date).toBe(TODAY)
    expect(state.repetitions).toBe(0)
    expect(state.ease_factor).toBe(DEFAULT_EASE_FACTOR)
  })

  it('первый успех даёт один день', () => {
    const outcome = review(
      { ease_factor: DEFAULT_EASE_FACTOR, interval_days: 0, repetitions: 0 },
      GRADE_EASY,
      TODAY,
    )
    expect(outcome.interval_days).toBe(1)
    expect(outcome.due_date).toBe('2026-08-03')
    expect(outcome.repetitions).toBe(1)
  })

  it('второй успех даёт шесть дней', () => {
    const outcome = review(
      { ease_factor: DEFAULT_EASE_FACTOR, interval_days: 1, repetitions: 1 },
      GRADE_EASY,
      TODAY,
    )
    expect(outcome.interval_days).toBe(6)
    expect(outcome.due_date).toBe('2026-08-08')
  })

  it('дальше интервал умножается на ease factor', () => {
    const outcome = review({ ease_factor: 2.5, interval_days: 6, repetitions: 2 }, GRADE_EASY, TODAY)
    expect(outcome.interval_days).toBe(16)
    expect(outcome.repetitions).toBe(3)
  })

  it('«забыл» сбрасывает серию и возвращает карточку завтра', () => {
    const outcome = review(
      { ease_factor: 2.5, interval_days: 30, repetitions: 5 },
      GRADE_FORGOT,
      TODAY,
    )
    expect(outcome.interval_days).toBe(1)
    expect(outcome.repetitions).toBe(0)
    expect(outcome.due_date).toBe('2026-08-03')
    expect(outcome.ease_factor).toBeLessThan(2.5)
  })

  it('«с трудом» продвигает серию, но снижает ease factor', () => {
    const outcome = review({ ease_factor: 2.5, interval_days: 6, repetitions: 2 }, GRADE_HARD, TODAY)
    expect(outcome.repetitions).toBe(3)
    expect(outcome.ease_factor).toBeLessThan(2.5)
    expect(outcome.interval_days).toBeGreaterThan(6)
  })

  it('ease factor не падает ниже предела', () => {
    let ease = DEFAULT_EASE_FACTOR
    for (let i = 0; i < 20; i += 1) {
      ease = review({ ease_factor: ease, interval_days: 1, repetitions: 0 }, GRADE_FORGOT, TODAY)
        .ease_factor
    }
    expect(ease).toBe(MIN_EASE_FACTOR)
  })

  it('лёгкий ответ повышает ease factor', () => {
    const outcome = review({ ease_factor: 2.5, interval_days: 6, repetitions: 2 }, GRADE_EASY, TODAY)
    expect(outcome.ease_factor).toBeGreaterThan(2.5)
  })

  it('переход через границу месяца считается верно', () => {
    const outcome = review(
      { ease_factor: DEFAULT_EASE_FACTOR, interval_days: 1, repetitions: 1 },
      GRADE_EASY,
      '2026-08-28',
    )
    expect(outcome.due_date).toBe('2026-09-03')
  })

  it('недопустимая оценка отклоняется', () => {
    expect(() => review({ ease_factor: 2.5, interval_days: 1, repetitions: 1 }, 4, TODAY)).toThrow()
  })
})
