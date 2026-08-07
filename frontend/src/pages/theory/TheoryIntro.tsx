/**
 * Вводный экран раздела теории: что есть в блоке и с чего продолжить.
 *
 * Автоперехода на первый конспект намеренно нет: он менял бы адрес под пользователем, и ссылка
 * «Теория» в истории браузера вела бы уже не туда, куда кликали.
 */

import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../../components/ui'
import { useTheory } from './TheoryLayout'

export function TheoryIntro() {
  const { block, notes, groups, ordered } = useTheory()

  if (notes.length === 0) {
    return (
      <EmptyState
        title="Конспектов в этом блоке пока нет"
        hint={`Создай первый: uv run python -m tools new-note ${block.slug} «Название темы»`}
      />
    )
  }

  const readCount = notes.filter((note) => note.is_read).length
  const cardsCount = notes.reduce((sum, note) => sum + note.cards_count, 0)
  // Продолжаем с первого непрочитанного по порядку списка; всё прочитано — с самого начала.
  const next = ordered.find((note) => !note.is_read) ?? ordered[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">Теория</h1>
        <p className="mt-1 text-muted">
          Конспектов: {notes.length} · карточек: {cardsCount} · прочитано: {readCount}
        </p>
      </div>

      <div className="space-y-2">
        {groups.map((group, index) => (
          <Card key={group.slug ?? 'without-topic'} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {/* Нумеруются только настоящие темы: «Без темы» — остаток, а не тема N. */}
                {group.slug && <span className="text-muted">Тема {index + 1} · </span>}
                {group.title}
              </h2>
              <span className="text-xs text-muted">
                конспектов: {group.notes.length} · прочитано:{' '}
                {group.notes.filter((note) => note.is_read).length}
              </span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {group.notes.map((note) => (
                <li key={note.slug}>
                  {note.is_read && <span className="mr-1 text-success">✓</span>}
                  {note.title}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {next && (
        <Link
          to={`/b/${block.slug}/theory/${next.slug}`}
          className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-90"
        >
          {readCount > 0 && readCount < notes.length ? 'Продолжить' : 'Начать'}: {next.title}
        </Link>
      )}
    </div>
  )
}
