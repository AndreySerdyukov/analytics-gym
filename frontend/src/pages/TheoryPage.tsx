/** Теория: список конспектов и чтение одного конспекта. */

import { Link, useParams } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { Card, EmptyState, ErrorBox, Loader, Tag } from '../components/ui'
import type { Block } from '../data/types'
import { useAsync } from '../data/useAsync'

export function TheoryListPage({ blocks }: { blocks: Block[] }) {
  const notes = useAsync((source) => source.listNotes(), [])
  const blockTitle = (slug: string) => blocks.find((block) => block.slug === slug)?.title ?? slug

  if (notes.loading) return <Loader label="Загружаем конспекты" />
  if (notes.error) return <ErrorBox message={notes.error} onRetry={notes.reload} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Теория</h1>
        <p className="mt-1 text-muted">
          Конспекты для быстрого повторения. Вопросы из раздела «Карточки» попадают в режим
          интервальных повторений
        </p>
      </div>

      {notes.data && notes.data.length > 0 ? (
        <div className="space-y-2">
          {notes.data.map((note) => (
            <Link key={note.slug} to={`/theory/${note.slug}`}>
              <Card className="transition-colors hover:border-accent">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">{note.title}</h2>
                  <span className="shrink-0 text-xs text-muted">
                    {blockTitle(note.block_slug)} · карточек: {note.cards_count}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {note.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Конспектов пока нет"
          hint="Создай первый: uv run python -m tools new-note sql «Оконные функции»"
        />
      )}
    </div>
  )
}

export function NotePage() {
  const { noteSlug = '' } = useParams()
  const note = useAsync((source) => source.getNote(noteSlug), [noteSlug])

  if (note.loading) return <Loader label="Загружаем конспект" />
  if (note.error) return <ErrorBox message={note.error} onRetry={note.reload} />
  if (!note.data) return null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/theory" className="text-sm text-muted hover:text-text">
          ← ко всем конспектам
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold">{note.data.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {note.data.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-alt px-2.5 py-1">
              {tag}
            </span>
          ))}
          <span>· карточек: {note.data.cards_count}</span>
        </div>
      </div>

      <Card>
        <Markdown>{note.data.body_md}</Markdown>
      </Card>
    </div>
  )
}
