/** Таблица результата запроса. Широкие результаты скроллятся внутри себя, а не растягивают страницу. */

import { formatValue } from './compare'
import type { QueryResult } from './runner'

export function ResultTable({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return <p className="p-4 text-sm text-muted">Запрос не вернул колонок</p>
  }

  return (
    // Высота ограничена: результат на сотню строк иначе растягивает страницу на экраны вниз.
    <div className="max-h-[26rem] overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0">
          <tr className="border-b border-border bg-surface-alt">
            {result.columns.map((column, index) => (
              <th key={`${column}-${index}`} className="px-3 py-2 font-semibold whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-0">
              {row.map((value, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-3 py-1.5 font-mono text-xs whitespace-nowrap ${
                    value === null ? 'text-muted italic' : ''
                  }`}
                >
                  {formatValue(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {result.totalRows > result.rows.length && (
        <p className="border-t border-border px-3 py-2 text-xs text-muted">
          Показаны первые {result.rows.length} строк из {result.totalRows}
        </p>
      )}
      {result.rows.length === 0 && <p className="px-3 py-3 text-sm text-muted">0 строк</p>}
    </div>
  )
}

/** Компактная таблица без заголовков — для показа расхождений с эталоном. */
export function RowsPreview({ rows, columns }: { rows: unknown[][]; columns: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-2 py-1 font-mono text-xs whitespace-nowrap"
                  title={columns[cellIndex]}
                >
                  {formatValue(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
