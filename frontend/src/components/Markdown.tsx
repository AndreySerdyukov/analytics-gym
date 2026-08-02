/** Рендер Markdown с таблицами и подсветкой кода. Стили — в index.css (.markdown, .hljs-*). */

import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import ReactMarkdown, { type Options } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

// Языки перечислены явно: полный набор highlight.js весит сотни килобайт,
// а в контенте встречаются только эти три.
const languages = { sql, python, bash }

const remarkPlugins: Options['remarkPlugins'] = [remarkGfm]
const rehypePlugins: Options['rehypePlugins'] = [[rehypeHighlight, { languages, detect: false }]]

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`markdown ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
