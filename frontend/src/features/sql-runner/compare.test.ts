/** Тесты сравнения результата с эталоном — от него зависит вся автопроверка. */

import { describe, expect, it } from 'vitest'
import { compareResults, normalizeValue } from './compare'
import type { QueryResult } from './runner'

function result(columns: string[], rows: unknown[][]): QueryResult {
  return { columns, rows, totalRows: rows.length }
}

describe('normalizeValue', () => {
  it('приводит numeric-строку и число к одному виду', () => {
    // Postgres отдаёт numeric строкой, а float числом — иначе 1000 и "1000.00" разошлись бы.
    expect(normalizeValue('1000.00', 0.001)).toBe(normalizeValue(1000, 0.001))
  })

  it('считает равными числа в пределах допуска', () => {
    expect(normalizeValue(33.3333, 0.01)).toBe(normalizeValue(33.3334, 0.01))
  })

  it('различает числа за пределами допуска', () => {
    expect(normalizeValue(33.33, 0.01)).not.toBe(normalizeValue(33.35, 0.01))
  })

  it('NULL равен NULL', () => {
    expect(normalizeValue(null, 0.001)).toBe(normalizeValue(undefined, 0.001))
  })
})

describe('compareResults', () => {
  const expected = result(['category', 'revenue'], [
    ['Электроника', '1000.00'],
    ['Спорт', '500.00'],
  ])

  it('принимает совпадающий ответ', () => {
    const comparison = compareResults(expected, expected)
    expect(comparison.ok).toBe(true)
  })

  it('принимает другой порядок строк, когда порядок не важен', () => {
    const actual = result(['c', 'r'], [
      ['Спорт', 500],
      ['Электроника', 1000],
    ])
    expect(compareResults(actual, expected, { ordered: false }).ok).toBe(true)
  })

  it('отклоняет другой порядок строк, когда порядок важен', () => {
    const actual = result(['c', 'r'], [
      ['Спорт', 500],
      ['Электроника', 1000],
    ])
    const comparison = compareResults(actual, expected, { ordered: true })
    expect(comparison.ok).toBe(false)
    expect(comparison.summary).toContain('Строка №1')
  })

  it('сообщает о лишней колонке', () => {
    const actual = result(['c', 'r', 'extra'], [['Электроника', 1000, 1]])
    const comparison = compareResults(actual, expected)
    expect(comparison.ok).toBe(false)
    expect(comparison.summary).toContain('Ожидалось колонок: 2')
  })

  it('проверяет имена колонок, когда это включено', () => {
    const actual = result(['category', 'total'], [
      ['Электроника', 1000],
      ['Спорт', 500],
    ])
    const comparison = compareResults(actual, expected, { ignore_column_names: false })
    expect(comparison.ok).toBe(false)
    expect(comparison.summary).toContain('revenue')
  })

  it('показывает, каких строк не хватает и какие лишние', () => {
    const actual = result(['c', 'r'], [
      ['Электроника', 1000],
      ['Дом', 700],
    ])
    const comparison = compareResults(actual, expected)
    expect(comparison.ok).toBe(false)
    expect(comparison.missingRows).toEqual([['Спорт', '500.00']])
    expect(comparison.extraRows).toEqual([['Дом', 700]])
  })

  it('ловит расхождение при равном числе строк', () => {
    const actual = result(['c', 'r'], [
      ['Электроника', 1000],
      ['Спорт', 499],
    ])
    const comparison = compareResults(actual, expected)
    expect(comparison.ok).toBe(false)
    expect(comparison.summary).toContain('значения расходятся')
  })

  it('считает разными NULL и ноль', () => {
    const withNull = result(['c', 'r'], [['Спорт', null]])
    const withZero = result(['c', 'r'], [['Спорт', 0]])
    expect(compareResults(withZero, withNull).ok).toBe(false)
  })
})
