/** Небольшой хук загрузки данных: состояние, ошибка, ручное обновление. */

import { useCallback, useEffect, useState } from 'react'
import { getDataSource, type DataSource } from './source'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Выполняет запрос к источнику данных при изменении зависимостей.
 * Колбэк получает готовый DataSource — компонентам не нужно знать, какой именно.
 */
export function useAsync<T>(
  loader: (source: DataSource) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // Загрузчик пересоздаётся на каждый рендер, поэтому зависимости задаёт вызывающий код.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getDataSource()
      .then(run)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [run, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  return { data, loading, error, reload }
}
