/**
 * Хаб блока: выбор между теорией и практикой.
 *
 * Экран намеренно без единой асинхронной загрузки — обе сводки уже приехали вместе с блоком,
 * поэтому переход в блок мгновенный и цифры не мигают.
 */

import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, EmptyState, ProgressBar, Tag } from '../components/ui'
import type { Block } from '../data/types'

interface SectionProps {
  title: string
  description: string
  to: string
  countLabel: string
  done: number
  total: number
  emptyHint: string
}

/**
 * Половина хаба. Пустой раздел не ссылка, а приглушённая карточка: в блоках без задач или без
 * конспектов клик увёл бы на пустой экран без пути назад.
 */
function Section({ title, description, to, countLabel, done, total, emptyHint }: SectionProps) {
  const body: ReactNode = (
    <Card className={`h-full ${total > 0 ? 'transition-colors group-hover:border-accent' : 'opacity-60'}`}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>

      {total > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">
            {countLabel} {done} из {total}
          </p>
          <ProgressBar value={done} total={total} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{emptyHint}</p>
      )}
    </Card>
  )

  if (total === 0) return body
  return (
    <Link to={to} className="group">
      {body}
    </Link>
  )
}

export function BlockHubPage({ blocks }: { blocks: Block[] }) {
  const { blockSlug = '' } = useParams()
  const block = blocks.find((item) => item.slug === blockSlug)

  if (!block) return <EmptyState title="Такого блока нет" hint="Выбери блок в шапке" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">
          {block.icon && <span className="mr-2">{block.icon}</span>}
          {block.title}
        </h1>
        {block.description && <p className="mt-1 text-muted">{block.description}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          title="Теория"
          description="Конспекты по темам, вопросы из них уходят в повторение"
          to={`/b/${block.slug}/theory`}
          countLabel="Прочитано"
          done={block.notes_read}
          total={block.notes_total}
          emptyHint="Конспектов в этом блоке пока нет"
        />
        <Section
          title="Практика"
          description="Задачи с фильтрами и проверкой решения прямо в браузере"
          to={`/b/${block.slug}/practice`}
          countLabel="Решено"
          done={block.tasks_solved}
          total={block.tasks_total}
          emptyHint="Задач в этом блоке пока нет"
        />
      </div>

      {block.topics.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Темы блока</p>
          <div className="flex flex-wrap gap-1.5">
            {block.topics.map((topic) => (
              <Tag key={topic.slug}>{topic.title}</Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
