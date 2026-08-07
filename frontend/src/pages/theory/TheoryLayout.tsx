/**
 * Раздел теории блока: боковой список тем слева, конспект справа.
 *
 * Layout — элемент родительского маршрута, а конспекты рендерятся через <Outlet>. Это не
 * стилистический выбор: при переходе между конспектами react-router меняет только дочерний
 * элемент, поэтому список конспектов грузится один раз на весь раздел и боковая панель
 * не мигает. Отсюда же правило: в зависимостях useAsync здесь только blockSlug.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { EmptyState, ErrorBox, Loader, ProgressBar } from '../../components/ui'
import { getDataSource } from '../../data/source'
import type { Block, NoteListItem } from '../../data/types'
import { useAsync } from '../../data/useAsync'
import { flattenGroups, groupNotesByTopic, type TheoryGroup } from './grouping'
import { TheoryNav } from './TheoryNav'

export interface TheoryContext {
  block: Block
  notes: NoteListItem[]
  groups: TheoryGroup[]
  /** Порядок бокового списка: по нему работает переход к следующему конспекту. */
  ordered: NoteListItem[]
  loading: boolean
  error: string | null
  setRead: (slug: string, isRead: boolean) => Promise<void>
}

export function useTheory(): TheoryContext {
  return useOutletContext<TheoryContext>()
}

export function TheoryLayout({
  blocks,
  onNoteRead,
}: {
  blocks: Block[]
  onNoteRead: () => void
}) {
  const { blockSlug = '' } = useParams()
  const block = blocks.find((item) => item.slug === blockSlug)

  const list = useAsync((source) => source.listNotes(blockSlug), [blockSlug])
  const [notes, setNotes] = useState<NoteListItem[]>([])

  useEffect(() => {
    if (list.data) setNotes(list.data)
  }, [list.data])

  const groups = useMemo(
    () => groupNotesByTopic(block?.topics ?? [], notes),
    [block?.topics, notes],
  )
  const ordered = useMemo(() => flattenGroups(groups), [groups])

  // Локальная копия списка нужна, чтобы галочка появлялась сразу, без повторного запроса.
  const setRead = useCallback(
    async (slug: string, isRead: boolean) => {
      const source = await getDataSource()
      const saved = await source.setNoteRead(slug, isRead)
      setNotes((current) =>
        current.map((note) => (note.slug === slug ? { ...note, is_read: saved.is_read } : note)),
      )
      // Счётчики на хабе и дашборде живут в блоках — их перезагружает App.
      onNoteRead()
    },
    [onNoteRead],
  )

  if (!block) return <EmptyState title="Такого блока нет" hint="Выбери блок в шапке" />

  const readCount = notes.filter((note) => note.is_read).length
  const context: TheoryContext = {
    block,
    notes,
    groups,
    ordered,
    loading: list.loading,
    error: list.error,
    setRead,
  }

  // Без конспектов боковая колонка не нужна: сетка схлопывается в одну колонку.
  const withSidebar = notes.length > 0

  return (
    <div className="space-y-5">
      <Link to={`/b/${block.slug}`} className="inline-block text-sm text-muted hover:text-text">
        ← {block.title}
      </Link>

      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}

      <div className={withSidebar ? 'grid gap-8 md:grid-cols-[16rem_1fr]' : ''}>
        {withSidebar && (
          <>
            <aside className="hidden md:sticky md:top-24 md:block md:max-h-[calc(100vh-8rem)] md:overflow-y-auto">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Теория</p>
              <p className="mt-1.5 text-sm">
                Прочитано {readCount} из {notes.length}
              </p>
              <div className="mt-2">
                <ProgressBar value={readCount} total={notes.length} />
              </div>
              <div className="mt-5">
                <TheoryNav groups={groups} blockSlug={block.slug} />
              </div>
            </aside>

            {/* На узком экране оглавление сворачивается: иначе до текста нужно пролистать полэкрана. */}
            <details className="rounded-card border border-border bg-surface p-4 md:hidden">
              <summary className="cursor-pointer text-sm font-semibold">
                Содержание · прочитано {readCount} из {notes.length}
              </summary>
              <div className="mt-4">
                <TheoryNav groups={groups} blockSlug={block.slug} />
              </div>
            </details>
          </>
        )}

        <div>
          {list.loading && notes.length === 0 ? (
            <Loader label="Загружаем конспекты" />
          ) : (
            <Outlet context={context} />
          )}
        </div>
      </div>
    </div>
  )
}
