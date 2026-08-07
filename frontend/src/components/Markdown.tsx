/** Рендер Markdown с таблицами и подсветкой кода. Стили — в index.css (.markdown, .hljs-*). */

import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import ReactMarkdown, { type Options } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

// Языки перечислены явно: полный набор highlight.js весит сотни килобайт,
// а в контенте встречаются только эти три.
const languages = { sql, python, bash }

const remarkPlugins: Options['remarkPlugins'] = [remarkGfm]

/*
  rehype-raw включает разметку вроде <details><summary>Ответы</summary> в конспектах: сначала
  вспоминаешь сам, потом сверяешься. Идёт первым, потому что заново разбирает всё дерево —
  запущенный после подсветки он потерял бы вставленные ей <span class="hljs-*">.

  rehype-sanitize намеренно не подключён: через этот компонент проходит только markdown из
  content/ (мой же репозиторий) и личная заметка, которую я сам ввёл в своём браузере. Появится
  markdown из внешнего источника — санитайзер нужен, причём со схемой, разрешающей details,
  summary и className: по умолчанию он вырезает и их.
*/
const rehypePlugins: Options['rehypePlugins'] = [
  rehypeRaw,
  [rehypeHighlight, { languages, detect: false }],
]

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`markdown ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
