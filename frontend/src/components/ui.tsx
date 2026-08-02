/** Мелкие переиспользуемые элементы интерфейса. Цвета — только через токены тем. */

import type { ReactNode } from 'react'
import type { Difficulty, TaskStatus } from '../data/types'
import { DIFFICULTY_LABELS, STATUS_LABELS } from '../data/types'

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  easy: 'bg-success-soft text-success',
  medium: 'bg-warning-soft text-warning',
  hard: 'bg-danger-soft text-danger',
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: 'bg-surface-alt text-muted',
  in_progress: 'bg-warning-soft text-warning',
  solved: 'bg-success-soft text-success',
  failed: 'bg-danger-soft text-danger',
}

export function DifficultyBadge({ value }: { value: Difficulty }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DIFFICULTY_STYLES[value]}`}>
      {DIFFICULTY_LABELS[value]}
    </span>
  )
}

export function StatusBadge({ value }: { value: TaskStatus }) {
  if (value === 'new') return null
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[value]}`}>
      {STATUS_LABELS[value]}
    </span>
  )
}

export function Tag({ children, active, onClick }: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  const base = 'rounded-full px-3 py-1 text-xs font-medium transition-colors'
  const look = active
    ? 'bg-accent text-on-accent'
    : 'bg-surface-alt text-muted hover:text-text'
  if (!onClick) return <span className={`${base} ${look}`}>{children}</span>
  return (
    <button type="button" onClick={onClick} className={`${base} ${look} cursor-pointer`}>
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-5 ${className}`}
    >
      {children}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const look =
    variant === 'primary'
      ? 'bg-accent text-on-accent hover:opacity-90'
      : 'border border-border bg-surface text-text hover:bg-surface-alt'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${look} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  )
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Loader({ label = 'Загрузка' }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-muted">{label}…</p>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-card border border-danger bg-danger-soft p-5 text-sm text-danger">
      <p className="font-semibold">Не получилось загрузить данные</p>
      <p className="mt-1 opacity-90">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 font-semibold underline">
          Попробовать снова
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card border border-dashed border-border py-14 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}
