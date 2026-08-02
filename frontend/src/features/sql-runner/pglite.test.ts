/**
 * Интеграционный тест: настоящий датасет из content/ накатывается в PGlite, и все эталонные
 * решения выполняются на нём.
 *
 * Смысл именно в PGlite: `python -m tools validate` проверяет решения на «большом» Postgres,
 * а решает пользователь в браузерном. Этот тест ловит расхождения между ними — например,
 * функцию, которой в WASM-сборке не оказалось.
 */

import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { compareResults } from './compare'
import type { QueryResult } from './runner'

const CONTENT_DIR = join(import.meta.dirname, '../../../../content')
const DATASET_PATH = join(CONTENT_DIR, 'sql/datasets/ecommerce-v1.sql')
const TASKS_DIR = join(CONTENT_DIR, 'sql/tasks')

interface TaskFixture {
  file: string
  sql: string
  ordered: boolean
}

/** Достаёт эталонный запрос и настройку порядка из .md-файла задачи. */
function readTask(file: string): TaskFixture | null {
  const text = readFileSync(join(TASKS_DIR, file), 'utf-8')
  const solutionSection = text.split('## Решение')[1] ?? ''
  const sql = /```sql\s*\n([\s\S]*?)```/.exec(solutionSection)?.[1]?.trim()
  if (!sql) return null
  return { file, sql, ordered: /ordered:\s*true/.test(text) }
}

let db: PGlite

async function run(sql: string): Promise<QueryResult> {
  const results = await db.exec(sql, { rowMode: 'array' })
  const meaningful = [...results].reverse().find((item) => item.fields.length > 0)
  if (!meaningful) return { columns: [], rows: [], totalRows: 0 }
  const rows = meaningful.rows as unknown[][]
  return { columns: meaningful.fields.map((field) => field.name), rows, totalRows: rows.length }
}

describe('датасет и эталонные решения в PGlite', () => {
  const tasks = readdirSync(TASKS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map(readTask)
    .filter((task): task is TaskFixture => task !== null)

  beforeAll(async () => {
    const [schemaSql = '', seedSql = ''] = readFileSync(DATASET_PATH, 'utf-8').split(/^--\s*seed\s*$/m)
    db = await PGlite.create('memory://')
    await db.exec(schemaSql)
    await db.exec(seedSql)
  }, 60_000)

  it('в каталоге есть задачи с эталонными решениями', () => {
    expect(tasks.length).toBeGreaterThanOrEqual(10)
  })

  it('датасет наполнен', async () => {
    const result = await run('SELECT count(*) FROM users')
    expect(Number(result.rows[0]?.[0])).toBe(40)
  })

  for (const task of tasks) {
    it(`${task.file}: эталон выполняется и возвращает строки`, async () => {
      const result = await run(task.sql)
      expect(result.columns.length).toBeGreaterThan(0)
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it(`${task.file}: эталон совпадает сам с собой`, async () => {
      const result = await run(task.sql)
      const comparison = compareResults(result, result, { ordered: task.ordered })
      expect(comparison.ok).toBe(true)
    })
  }

  it('усечённый ответ признаётся неверным', async () => {
    const task = tasks.find((item) => item.file.includes('vyruchka-po-kategoriyam'))
    expect(task).toBeDefined()

    const expected = await run(task!.sql)
    const truncated = await run(`SELECT * FROM (${task!.sql.replace(/;\s*$/, '')}) t LIMIT 1`)
    const comparison = compareResults(truncated, expected, { ordered: true })

    expect(comparison.ok).toBe(false)
    expect(comparison.summary).toContain('не хватает')
  })

  it('запрос с лишней колонкой признаётся неверным', async () => {
    const expected = await run('SELECT country FROM users ORDER BY user_id')
    const actual = await run('SELECT country, user_id FROM users ORDER BY user_id')
    expect(compareResults(actual, expected).ok).toBe(false)
  })

  it('другой порядок строк проходит, когда порядок не важен', async () => {
    const expected = await run('SELECT user_id FROM users ORDER BY user_id')
    const actual = await run('SELECT user_id FROM users ORDER BY user_id DESC')
    expect(compareResults(actual, expected, { ordered: false }).ok).toBe(true)
    expect(compareResults(actual, expected, { ordered: true }).ok).toBe(false)
  })
})
