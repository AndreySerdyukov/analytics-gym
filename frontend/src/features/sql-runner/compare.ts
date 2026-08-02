/**
 * Сравнение результата пользователя с эталоном.
 *
 * Эталон не хранится заранее: при каждой проверке выполняются оба запроса на одном датасете,
 * поэтому правка датасета не ломает задачи. Здесь остаётся честно сравнить две таблицы —
 * с поправкой на то, что «правильных» форм ответа обычно несколько: другой порядок строк,
 * другие имена колонок, numeric против float.
 */

import type { CheckConfig } from '../../data/types'
import { DEFAULT_CHECK_CONFIG } from '../../data/types'
import type { QueryResult } from './runner'

export interface Comparison {
  ok: boolean
  /** Одна фраза о том, что не так — она же уходит в историю попыток. */
  summary: string
  /** Строки эталона, которых не хватает в ответе. */
  missingRows: unknown[][]
  /** Строки ответа, которых нет в эталоне. */
  extraRows: unknown[][]
  expectedColumns: string[]
}

const NUMERIC_RE = /^-?\d+(\.\d+)?$/

function pluralRows(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} строк`
  if (last === 1) return `${count} строка`
  if (last >= 2 && last <= 4) return `${count} строки`
  return `${count} строк`
}

/**
 * Приводит значение к каноническому виду для сравнения.
 *
 * Postgres отдаёт numeric строкой, а float — числом: без нормализации 1000 и "1000.00"
 * считались бы разными. Числа квантуются с шагом tolerance, поэтому расхождение
 * в последнем знаке после запятой не превращается в «неверно».
 */
export function normalizeValue(value: unknown, tolerance: number): string {
  if (value === null || value === undefined) return '∅'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'

  const asNumber =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && NUMERIC_RE.test(value.trim())
        ? Number(value.trim())
        : null

  if (asNumber !== null && Number.isFinite(asNumber)) {
    if (tolerance > 0) return String(Math.round(asNumber / tolerance))
    return String(asNumber)
  }

  return String(value).trim()
}

function rowKey(row: unknown[], tolerance: number): string {
  return JSON.stringify(row.map((value) => normalizeValue(value, tolerance)))
}

/** Сравнивает результат пользователя с эталонным по правилам из frontmatter задачи. */
export function compareResults(
  actual: QueryResult,
  expected: QueryResult,
  config: Partial<CheckConfig> = {},
): Comparison {
  const { ordered, tolerance, ignore_column_names } = { ...DEFAULT_CHECK_CONFIG, ...config }
  const base = { missingRows: [], extraRows: [], expectedColumns: expected.columns }

  if (actual.columns.length !== expected.columns.length) {
    return {
      ...base,
      ok: false,
      summary:
        `Ожидалось колонок: ${expected.columns.length} (${expected.columns.join(', ')}), ` +
        `а вернулось: ${actual.columns.length}`,
    }
  }

  if (!ignore_column_names) {
    const mismatch = expected.columns.findIndex(
      (name, index) => name.toLowerCase() !== (actual.columns[index] ?? '').toLowerCase(),
    )
    if (mismatch >= 0) {
      return {
        ...base,
        ok: false,
        summary:
          `Колонка №${mismatch + 1} должна называться «${expected.columns[mismatch]}», ` +
          `а называется «${actual.columns[mismatch]}»`,
      }
    }
  }

  if (actual.rows.length !== expected.rows.length) {
    const diff = actual.rows.length - expected.rows.length
    return {
      ...base,
      ok: false,
      summary:
        `Ожидалось ${pluralRows(expected.rows.length)}, а вернулось ` +
        `${pluralRows(actual.rows.length)} (${diff > 0 ? 'лишних' : 'не хватает'} ${Math.abs(diff)})`,
      ...diffRows(actual.rows, expected.rows, tolerance),
    }
  }

  if (ordered) {
    const index = expected.rows.findIndex(
      (row, position) => rowKey(row, tolerance) !== rowKey(actual.rows[position] ?? [], tolerance),
    )
    if (index >= 0) {
      return {
        ...base,
        ok: false,
        summary: `Строка №${index + 1} отличается от ожидаемой`,
        missingRows: expected.rows.slice(index, index + 1),
        extraRows: actual.rows.slice(index, index + 1),
      }
    }
    return { ...base, ok: true, summary: 'Результат совпадает с эталоном' }
  }

  const diff = diffRows(actual.rows, expected.rows, tolerance)
  if (diff.missingRows.length || diff.extraRows.length) {
    return {
      ...base,
      ok: false,
      summary:
        `Число строк совпадает, но значения расходятся: ` +
        `${pluralRows(diff.missingRows.length)} не найдено, ` +
        `${pluralRows(diff.extraRows.length)} лишних`,
      ...diff,
    }
  }

  return { ...base, ok: true, summary: 'Результат совпадает с эталоном' }
}

/** Находит расхождение двух наборов строк как мультимножеств. */
function diffRows(
  actualRows: unknown[][],
  expectedRows: unknown[][],
  tolerance: number,
): { missingRows: unknown[][]; extraRows: unknown[][] } {
  const expectedCounts = new Map<string, number>()
  for (const row of expectedRows) {
    const key = rowKey(row, tolerance)
    expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1)
  }

  const extraRows: unknown[][] = []
  for (const row of actualRows) {
    const key = rowKey(row, tolerance)
    const count = expectedCounts.get(key) ?? 0
    if (count > 0) {
      expectedCounts.set(key, count - 1)
    } else {
      extraRows.push(row)
    }
  }

  const remaining = new Set<string>()
  for (const [key, count] of expectedCounts) {
    if (count > 0) remaining.add(key)
  }
  const missingRows = expectedRows.filter((row) => remaining.has(rowKey(row, tolerance)))

  // Показывать десятки расхождений бессмысленно: первых пяти достаточно, чтобы понять ошибку.
  return { missingRows: missingRows.slice(0, 5), extraRows: extraRows.slice(0, 5) }
}

/** Формат значения для таблицы результатов. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '')
  return String(value)
}
