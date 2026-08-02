/**
 * Рабочее место для SQL-задачи: редактор, запуск в PGlite и сравнение с эталоном.
 *
 * Проверка устроена так: выполняются два запроса на одном датасете — пользовательский и
 * эталонный из задачи. Ожидаемый результат нигде не хранится, поэтому правка датасета не
 * ломает задачи.
 */

import { sql as sqlLang, PostgreSQL } from '@codemirror/lang-sql'
import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import type { Progress, TaskDetail } from '../../data/types'
import { DEFAULT_CHECK_CONFIG } from '../../data/types'
import { getDataSource } from '../../data/source'
import { compareResults, type Comparison } from './compare'
import { editorTheme } from './editor-theme'
import { ResultTable, RowsPreview } from './ResultTable'
import { SqlRunner, type QueryResult } from './runner'

interface Props {
  task: TaskDetail
  onProgress: (progress: Progress) => void
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'failed'; message: string }
  | { kind: 'checked'; result: QueryResult; comparison: Comparison }

/** Достаёт таблицы и колонки из DDL — нужно только для автодополнения в редакторе. */
function parseSchema(schemaSql: string): Record<string, string[]> {
  const schema: Record<string, string[]> = {}
  const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s*\(([\s\S]*?)\n\)/gi

  for (const match of schemaSql.matchAll(tableRe)) {
    const [, table, body] = match
    if (!table || !body) continue
    const columns = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line))
      .map((line) => line.split(/\s+/)[0]?.replace(/[",]/g, '') ?? '')
      .filter(Boolean)
    schema[table] = columns
  }
  return schema
}

function draftKey(slug: string): string {
  return `gym-draft-${slug}`
}

export function SqlWorkbench({ task, onProgress }: Props) {
  const dataset = task.dataset
  const [code, setCode] = useState(() => localStorage.getItem(draftKey(task.slug)) ?? '')
  const [state, setState] = useState<RunState>({ kind: 'idle' })
  const openedAt = useRef(Date.now())
  const runnerRef = useRef<SqlRunner | null>(null)

  const checkConfig = { ...DEFAULT_CHECK_CONFIG, ...task.check_config }
  const schema = useMemo(() => (dataset ? parseSchema(dataset.schema_sql) : {}), [dataset])

  // Раннер живёт столько же, сколько открытая задача: при уходе воркер убиваем,
  // иначе WASM-инстанс Postgres останется висеть в памяти вкладки.
  useEffect(() => {
    if (!dataset) return
    const runner = new SqlRunner(dataset.schema_sql, dataset.seed_sql)
    runnerRef.current = runner
    openedAt.current = Date.now()
    return () => {
      runner.dispose()
      runnerRef.current = null
    }
  }, [dataset])

  useEffect(() => {
    localStorage.setItem(draftKey(task.slug), code)
  }, [code, task.slug])

  const run = useCallback(async () => {
    const runner = runnerRef.current
    if (!runner || !code.trim()) return

    setState({ kind: 'running' })
    const durationSeconds = Math.round((Date.now() - openedAt.current) / 1000)
    const source = await getDataSource()

    let result: QueryResult
    try {
      result = await runner.run(code, { maxRows: checkConfig.max_rows })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setState({ kind: 'failed', message })
      const progress = await source.saveAttempt(task.slug, {
        submitted_code: code,
        is_correct: false,
        duration_seconds: durationSeconds,
        error_text: message,
      })
      onProgress(progress)
      return
    }

    // Без эталона сравнивать не с чем — показываем результат как есть, попытку не засчитываем.
    if (!task.solution_sql) {
      setState({
        kind: 'checked',
        result,
        comparison: {
          ok: false,
          summary: 'У задачи нет эталонного запроса — проверить автоматически нечем',
          missingRows: [],
          extraRows: [],
          expectedColumns: [],
        },
      })
      return
    }

    let comparison: Comparison
    try {
      const expected = await runner.run(task.solution_sql, { maxRows: 100_000 })
      comparison = compareResults(result, expected, checkConfig)
    } catch (error) {
      setState({
        kind: 'failed',
        message: `Не удалось выполнить эталонный запрос: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
      return
    }

    setState({ kind: 'checked', result, comparison })
    const progress = await source.saveAttempt(task.slug, {
      submitted_code: code,
      is_correct: comparison.ok,
      duration_seconds: durationSeconds,
      error_text: comparison.ok ? null : comparison.summary,
    })
    onProgress(progress)
  }, [code, checkConfig, onProgress, task.slug, task.solution_sql])

  if (!dataset) {
    return (
      <div className="rounded-card border border-dashed border-border p-5 text-sm text-muted">
        У задачи нет датасета — решение проверяется по разбору, а не автоматически.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm font-semibold">Твой запрос</span>
          <span className="text-xs text-muted">Cmd+Enter — выполнить</span>
        </div>
        <CodeMirror
          value={code}
          height="260px"
          // theme="none" — встроенные темы отключены, цвета задаёт editorTheme и index.css.
          theme="none"
          extensions={[sqlLang({ dialect: PostgreSQL, schema, upperCaseKeywords: true }), editorTheme]}
          onChange={setCode}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void run()
            }
          }}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
        />
        <div className="flex items-center gap-3 border-t border-border px-4 py-3">
          <Button onClick={() => void run()} disabled={state.kind === 'running' || !code.trim()}>
            {state.kind === 'running' ? 'Выполняем…' : 'Запустить'}
          </Button>
          <Button variant="ghost" onClick={() => setCode('')}>
            Очистить
          </Button>
        </div>
      </div>

      {state.kind === 'failed' && (
        <div className="rounded-card border border-danger bg-danger-soft p-4 text-sm text-danger">
          <p className="font-semibold">Ошибка выполнения</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{state.message}</pre>
        </div>
      )}

      {state.kind === 'checked' && (
        <>
          <div
            className={`rounded-card border p-4 text-sm ${
              state.comparison.ok
                ? 'border-success bg-success-soft text-success'
                : 'border-warning bg-warning-soft text-warning'
            }`}
          >
            <p className="font-semibold">
              {state.comparison.ok ? '✓ Верно' : '✗ Не совпало с эталоном'}
            </p>
            <p className="mt-1 opacity-90">{state.comparison.summary}</p>

            {state.comparison.missingRows.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase opacity-80">Ожидалось, но не найдено</p>
                <RowsPreview
                  rows={state.comparison.missingRows}
                  columns={state.comparison.expectedColumns}
                />
              </div>
            )}
            {state.comparison.extraRows.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase opacity-80">Лишнее в ответе</p>
                <RowsPreview
                  rows={state.comparison.extraRows}
                  columns={state.comparison.expectedColumns}
                />
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="border-b border-border px-4 py-2 text-sm font-semibold">Результат</div>
            <ResultTable result={state.result} />
          </div>
        </>
      )}
    </div>
  )
}
