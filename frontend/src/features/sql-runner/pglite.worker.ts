/**
 * Воркер с настоящим PostgreSQL (PGlite, WASM).
 *
 * Живёт отдельным потоком по двум причинам: тяжёлый запрос не подвешивает интерфейс, и
 * зависший запрос можно прервать единственным способом, который вообще существует для
 * WASM-Postgres — убить воркер целиком (terminate) и поднять новый.
 */

import { PGlite } from '@electric-sql/pglite'

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  /** Сколько строк вернул запрос до усечения до max_rows. */
  totalRows: number
}

export type WorkerRequest =
  | { type: 'init'; schemaSql: string; seedSql: string }
  | { type: 'run'; id: number; sql: string; maxRows: number }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; result: QueryResult }
  | { type: 'error'; id: number | null; message: string }

let db: PGlite | null = null

/** Приводит ошибку Postgres к тексту, который имеет смысл показать решающему. */
function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

async function init(schemaSql: string, seedSql: string): Promise<void> {
  if (!db) {
    db = await PGlite.create('memory://')
  } else {
    // Схема пересоздаётся начисто: результат не зависит ни от предыдущей задачи,
    // ни от того, что пользователь успел уронить своим запросом.
    await db.exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  }

  await db.exec(schemaSql)
  if (seedSql.trim()) await db.exec(seedSql)
}

async function run(sql: string, maxRows: number): Promise<QueryResult> {
  if (!db) throw new Error('База ещё не готова')

  // Запрос выполняется в транзакции, которая всегда откатывается: INSERT, UPDATE или DROP
  // в пользовательском запросе не испортят датасет для следующей попытки.
  await db.exec('BEGIN')
  try {
    const results = await db.exec(sql, { rowMode: 'array' })

    // У пачки инструкций берём последнюю, которая вернула колонки — это и есть ответ.
    const meaningful = [...results].reverse().find((item) => item.fields.length > 0)
    if (!meaningful) {
      return { columns: [], rows: [], totalRows: 0 }
    }

    const rows = meaningful.rows as unknown[][]
    return {
      columns: meaningful.fields.map((field) => field.name),
      rows: rows.slice(0, maxRows),
      totalRows: rows.length,
    }
  } finally {
    await db.exec('ROLLBACK')
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    if (message.type === 'init') {
      await init(message.schemaSql, message.seedSql)
      postMessage({ type: 'ready' } satisfies WorkerResponse)
      return
    }
    const result = await run(message.sql, message.maxRows)
    postMessage({ type: 'result', id: message.id, result } satisfies WorkerResponse)
  } catch (error) {
    postMessage({
      type: 'error',
      id: message.type === 'run' ? message.id : null,
      message: describeError(error),
    } satisfies WorkerResponse)
  }
}
