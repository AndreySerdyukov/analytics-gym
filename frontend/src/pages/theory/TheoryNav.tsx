/**
 * Боковой список тем и конспектов. Один компонент на две раскладки: колонка и мобильное меню.
 *
 * Тема — раскрывающаяся группа: при десятке тем в блоке плоский список перестаёт читаться.
 * Группа с открытым конспектом раскрыта всегда: свернуть то, что сейчас читаешь, бессмысленно.
 */

import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { TheoryGroup } from './grouping'

const itemClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-start justify-between gap-2 rounded-xl py-2 pr-2 pl-3.5 text-sm transition-colors ${
    isActive
      ? 'bg-accent-soft font-semibold text-accent-ink'
      : 'text-muted hover:bg-surface-alt hover:text-text'
  }`

function groupKey(group: TheoryGroup): string {
  return group.slug ?? 'without-topic'
}

export function TheoryNav({ groups, blockSlug }: { groups: TheoryGroup[]; blockSlug: string }) {
  const { pathname } = useLocation()
  // Хранятся только ручные переключения: по умолчанию тема раскрыта.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (key: string) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }))

  return (
    <nav className="space-y-4">
      {groups.map((group, index) => {
        const key = groupKey(group)
        const hasActive = group.notes.some(
          (note) => pathname === `/b/${blockSlug}/theory/${note.slug}`,
        )
        const open = hasActive || !collapsed[key]

        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={open}
              className="flex w-full items-start gap-1.5 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-surface-alt"
            >
              <span
                aria-hidden="true"
                className={`mt-3 shrink-0 text-sm leading-none text-muted transition-transform ${
                  open ? 'rotate-90' : ''
                }`}
              >
                ▶
              </span>
              <span>
                {/* Нумеруются только настоящие темы: «Без темы» — это остаток, а не тема N. */}
                {group.slug && (
                  <span className="block text-xs font-semibold tracking-wide text-muted uppercase">
                    Тема {index + 1}
                  </span>
                )}
                <span className="block text-sm font-semibold">{group.title}</span>
              </span>
            </button>

            {open && (
              <ul className="mt-1 ml-1.5 space-y-0.5 border-l border-border pl-1.5">
                {group.notes.map((note) => (
                  <li key={note.slug}>
                    <NavLink to={`/b/${blockSlug}/theory/${note.slug}`} className={itemClass}>
                      <span>{note.title}</span>
                      {/* Место под галочку занято всегда, иначе заголовки прыгают при отметке. */}
                      <span className="w-3.5 shrink-0 text-center text-success">
                        {note.is_read ? '✓' : ''}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
