/** Боковой список тем и конспектов. Один компонент на две раскладки: колонка и мобильное меню. */

import { NavLink } from 'react-router-dom'
import type { TheoryGroup } from './grouping'

const itemClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent-soft font-semibold text-accent-ink'
      : 'text-muted hover:bg-surface-alt hover:text-text'
  }`

export function TheoryNav({ groups, blockSlug }: { groups: TheoryGroup[]; blockSlug: string }) {
  return (
    <nav className="space-y-5">
      {groups.map((group) => (
        <div key={group.slug ?? 'without-topic'}>
          <p className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">
            {group.title}
          </p>
          <ul className="mt-1.5 space-y-0.5">
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
        </div>
      ))}
    </nav>
  )
}
