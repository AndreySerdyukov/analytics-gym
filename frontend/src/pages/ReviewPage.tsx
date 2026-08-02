/**
 * Режим повторения: карточка, самооценка, следующая.
 *
 * Смысл в том, чтобы сначала честно вспомнить ответ и только потом его увидеть — поэтому
 * ответ скрыт до явного действия, а оценка выставляется уже после показа.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { Button, Card as Panel, EmptyState, ErrorBox, Loader } from '../components/ui'
import { getDataSource } from '../data/source'
import { GRADE_EASY, GRADE_FORGOT, GRADE_HARD } from '../data/srs'
import type { Card } from '../data/types'
import { useAsync } from '../data/useAsync'

const GRADE_BUTTONS = [
  { grade: GRADE_FORGOT, label: 'Забыл', hint: 'завтра снова', tone: 'danger' },
  { grade: GRADE_HARD, label: 'С трудом', hint: 'скоро повторим', tone: 'warning' },
  { grade: GRADE_EASY, label: 'Легко', hint: 'вернётся нескоро', tone: 'success' },
] as const

const TONE_STYLES = {
  danger: 'border-danger bg-danger-soft text-danger',
  warning: 'border-warning bg-warning-soft text-warning',
  success: 'border-success bg-success-soft text-success',
} as const

/** Человеческая подпись «через сколько вернётся» вместо голой даты. */
function formatInterval(days: number): string {
  if (days <= 1) return 'завтра'
  if (days < 5) return `через ${days} дня`
  if (days < 30) return `через ${days} дней`
  const months = Math.round(days / 30)
  return months <= 1 ? 'через месяц' : `через ${months} мес.`
}

export function ReviewPage({ onReviewed }: { onReviewed: () => void }) {
  const queue = useAsync((source) => source.dueCards(undefined, 30), [])
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastInterval, setLastInterval] = useState<number | null>(null)
  const [reviewedCount, setReviewedCount] = useState(0)

  useEffect(() => {
    if (queue.data) {
      setCards(queue.data)
      setIndex(0)
      setRevealed(false)
      setReviewedCount(0)
    }
  }, [queue.data])

  const current = cards[index]

  const grade = useCallback(
    async (value: number) => {
      if (!current) return
      const source = await getDataSource()
      const state = await source.gradeCard(current.slug, value)
      setLastInterval(state.interval_days)
      setReviewedCount((count) => count + 1)
      setRevealed(false)
      setIndex((position) => position + 1)
      onReviewed()
    },
    [current, onReviewed],
  )

  // Пробел раскрывает ответ, цифры 1-3 ставят оценку: повторять удобнее с клавиатуры.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!current) return
      if (event.code === 'Space' && !revealed) {
        event.preventDefault()
        setRevealed(true)
        return
      }
      if (!revealed) return
      const button = GRADE_BUTTONS[Number(event.key) - 1]
      if (button) void grade(button.grade)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, revealed, grade])

  if (queue.loading) return <Loader label="Собираем карточки" />
  if (queue.error) return <ErrorBox message={queue.error} onRetry={queue.reload} />

  if (!current) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">Повторение</h1>
        {reviewedCount > 0 ? (
          <EmptyState
            title={`Готово: ${reviewedCount} карточек за подход`}
            hint="Очередь на сегодня пуста. Новые карточки появятся, когда подойдёт их срок"
          />
        ) : (
          <EmptyState
            title="На сегодня всё повторено"
            hint="Карточки берутся из конспектов теории и возвращаются по алгоритму SM-2"
          />
        )}
        <Link to="/theory" className="inline-block text-sm font-semibold text-accent underline">
          Открыть теорию
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Повторение</h1>
        <span className="text-sm text-muted">
          {index + 1} из {cards.length}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <Panel className="min-h-[16rem]">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-surface-alt px-2.5 py-1">{current.block_slug}</span>
          {current.note_title && <span>· {current.note_title}</span>}
          {current.repetitions > 0 && <span>· повторений: {current.repetitions}</span>}
        </div>

        <div className="mt-4 text-lg font-semibold">
          <Markdown>{current.question_md}</Markdown>
        </div>

        {revealed ? (
          <div className="mt-5 border-t border-border pt-4">
            <Markdown>{current.answer_md}</Markdown>
          </div>
        ) : (
          <div className="mt-6">
            <Button onClick={() => setRevealed(true)}>Показать ответ</Button>
            <p className="mt-2 text-xs text-muted">или пробел</p>
          </div>
        )}
      </Panel>

      {revealed && (
        <div className="grid grid-cols-3 gap-2">
          {GRADE_BUTTONS.map((button, position) => (
            <button
              key={button.grade}
              type="button"
              onClick={() => void grade(button.grade)}
              className={`rounded-card border p-3 text-sm font-semibold transition hover:opacity-90 ${TONE_STYLES[button.tone]}`}
            >
              {button.label}
              <span className="mt-0.5 block text-xs font-normal opacity-80">{button.hint}</span>
              <span className="mt-1 block text-xs font-normal opacity-60">{position + 1}</span>
            </button>
          ))}
        </div>
      )}

      {lastInterval !== null && (
        <p className="text-center text-xs text-muted">
          Предыдущая карточка вернётся {formatInterval(lastInterval)}
        </p>
      )}
    </div>
  )
}
