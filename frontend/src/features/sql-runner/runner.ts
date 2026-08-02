/**
 * Управление воркером PGlite из главного потока: инициализация датасета, запуск запроса
 * и жёсткий таймаут.
 *
 * Прервать выполняющийся запрос в WASM-Postgres иначе нельзя: единственный надёжный способ —
 * убить воркер. Поэтому по таймауту воркер уничтожается, а следующий запуск поднимает новый
 * и заново накатывает датасет.
 */

import type { QueryResult, WorkerRequest, WorkerResponse } from './pglite.worker'

export type { QueryResult }

export const DEFAULT_TIMEOUT_MS = 10_000

interface PendingRequest {
  resolve: (result: QueryResult) => void
  reject: (error: Error) => void
}

export class SqlRunner {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private pending = new Map<number, PendingRequest>()
  private nextId = 1

  constructor(
    private readonly schemaSql: string,
    private readonly seedSql: string,
  ) {}

  /** Поднимает воркер и накатывает датасет. Повторные вызовы переиспользуют готовый инстанс. */
  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready

    this.ready = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./pglite.worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker = worker

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data
        if (message.type === 'ready') {
          resolve()
          return
        }
        if (message.type === 'result') {
          this.pending.get(message.id)?.resolve(message.result)
          this.pending.delete(message.id)
          return
        }
        if (message.id === null) {
          reject(new Error(message.message))
          return
        }
        this.pending.get(message.id)?.reject(new Error(message.message))
        this.pending.delete(message.id)
      }

      worker.onerror = (event) => {
        const error = new Error(event.message || 'Ошибка воркера с базой данных')
        reject(error)
        for (const request of this.pending.values()) request.reject(error)
        this.pending.clear()
      }

      const request: WorkerRequest = {
        type: 'init',
        schemaSql: this.schemaSql,
        seedSql: this.seedSql,
      }
      worker.postMessage(request)
    })

    return this.ready
  }

  /** Выполняет запрос. По истечении таймаута воркер убивается, а вызов падает с ошибкой. */
  async run(
    sql: string,
    { maxRows = 200, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
  ): Promise<QueryResult> {
    await this.ensureReady()
    const worker = this.worker
    if (!worker) throw new Error('База данных недоступна')

    const id = this.nextId++
    const result = new Promise<QueryResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ type: 'run', id, sql, maxRows } satisfies WorkerRequest)
    })

    let timer: number | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => {
        this.dispose()
        reject(
          new Error(
            `Запрос выполнялся дольше ${Math.round(timeoutMs / 1000)} с и был прерван. ` +
              `Чаще всего причина — случайное декартово произведение в соединении.`,
          ),
        )
      }, timeoutMs)
    })

    try {
      return await Promise.race([result, timeout])
    } finally {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }

  /** Убивает воркер. Следующий запуск поднимет новый и заново накатит датасет. */
  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    for (const request of this.pending.values()) {
      request.reject(new Error('Выполнение прервано'))
    }
    this.pending.clear()
  }
}
