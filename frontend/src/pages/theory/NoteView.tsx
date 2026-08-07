/** Чтение конспекта: текст, отметка о прочтении и переход к следующей теме. */

import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Markdown } from '../../components/Markdown'
import { Button, Card, ErrorBox, Loader } from '../../components/ui'
import { useAsync } from '../../data/useAsync'
import { useTheory } from './TheoryLayout'

export function NoteView() {
  const { blockSlug = '', noteSlug = '' } = useParams()
  const { ordered, notes, setRead } = useTheory()
  const navigate = useNavigate()

  const note = useAsync((source) => source.getNote(noteSlug), [noteSlug])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Layout при переходе между конспектами не размонтируется, поэтому react-router не сбрасывает
  // скролл: без этого следующий конспект открывался бы с середины.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    setSaveError(null)
  }, [noteSlug])

  if (note.loading) return <Loader label="Загружаем конспект" />
  if (note.error || !note.data) {
    return (
      <div className="space-y-3">
        <ErrorBox message={note.error ?? 'Конспект не найден'} onRetry={note.reload} />
        <Link to={`/b/${blockSlug}/theory`} className="text-sm font-semibold text-accent-ink underline">
          Ко всем конспектам блока
        </Link>
      </div>
    )
  }

  // Адрес мог указывать на конспект чужого блока — уводим туда, где он на самом деле лежит.
  if (note.data.block_slug !== blockSlug) {
    return <Navigate to={`/b/${note.data.block_slug}/theory/${note.data.slug}`} replace />
  }

  // Состояние отметки берём из списка: там оно обновляется сразу, без перезапроса конспекта.
  const isRead = notes.find((item) => item.slug === noteSlug)?.is_read ?? note.data.is_read
  const position = ordered.findIndex((item) => item.slug === noteSlug)
  const next = position >= 0 ? ordered[position + 1] : undefined

  const changeRead = async (value: boolean, goNext: boolean) => {
    setSaving(true)
    setSaveError(null)
    try {
      await setRead(noteSlug, value)
      // При ошибке остаёмся на странице: уход выглядел бы как успешно сохранённая отметка.
      if (goNext) {
        navigate(next ? `/b/${blockSlug}/theory/${next.slug}` : `/b/${blockSlug}`)
      }
    } catch (cause: unknown) {
      setSaveError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">{note.data.title}</h1>
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

      <Card className="flex flex-wrap items-center justify-between gap-3">
        {isRead ? (
          <>
            <span className="text-sm font-semibold text-success">✓ Прочитано</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" disabled={saving} onClick={() => void changeRead(false, false)}>
                Снять отметку
              </Button>
              {next && (
                <Link
                  to={`/b/${blockSlug}/theory/${next.slug}`}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-90"
                >
                  Дальше: {next.title}
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-muted">
              {next ? `Следующая тема: ${next.title}` : 'Это последняя тема блока'}
            </span>
            <Button disabled={saving} onClick={() => void changeRead(true, true)}>
              {next ? 'Прочитано, дальше →' : 'Прочитано, блок пройден'}
            </Button>
          </>
        )}
      </Card>

      {saveError && <p className="text-sm text-danger">Не удалось сохранить отметку: {saveError}</p>}
    </div>
  )
}
