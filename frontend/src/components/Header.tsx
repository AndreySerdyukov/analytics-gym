/** Шапка с переключением блоков и сквозными разделами: повторение и статистика. */

import { NavLink } from 'react-router-dom'
import type { Block } from '../data/types'
import { useTheme } from '../theme/useTheme'

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-accent text-on-accent' : 'text-muted hover:bg-surface-alt hover:text-text'
  }`

export function Header({ blocks, dueToday }: { blocks: Block[]; dueToday: number }) {
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <NavLink to="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold">
          <span className="rounded-lg bg-accent px-2 py-0.5 text-on-accent">gym</span>
          <span className="hidden sm:inline">analytics</span>
        </NavLink>

        {/* На узком экране вкладки уезжают в горизонтальный скролл, а не переносятся. */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {/* Без `end`: вкладка блока остаётся активной и на /b/:slug/theory, и на /practice. */}
          {blocks.map((block) => (
            <NavLink key={block.slug} to={`/b/${block.slug}`} className={linkClass}>
              {block.icon && <span className="mr-1.5">{block.icon}</span>}
              {block.title}
            </NavLink>
          ))}

          <span className="mx-1 h-5 w-px shrink-0 bg-border" />

          <NavLink to="/review" className={linkClass}>
            Повторение
            {dueToday > 0 && (
              <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-xs text-warning">
                {dueToday}
              </span>
            )}
          </NavLink>
          <NavLink to="/stats" className={linkClass}>
            Статистика
          </NavLink>
        </nav>

        <button
          type="button"
          onClick={toggle}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          aria-label="Переключить тему"
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-alt"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}
