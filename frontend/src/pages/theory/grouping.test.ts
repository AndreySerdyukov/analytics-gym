/** Группировка конспектов по темам: от неё зависит и боковой список, и кнопка «дальше». */

import { describe, expect, it } from 'vitest'
import type { NoteListItem, Topic } from '../../data/types'
import { flattenGroups, groupNotesByTopic } from './grouping'

const TOPICS: Topic[] = [
  { slug: 'core', title: 'Язык и структуры данных', sort_order: 0 },
  { slug: 'pandas', title: 'pandas', sort_order: 1 },
  { slug: 'algorithms', title: 'Алгоритмы', sort_order: 2 },
]

function note(slug: string, topicSlug: string | null): NoteListItem {
  return {
    slug,
    block_slug: 'python',
    topic_slug: topicSlug,
    title: slug,
    tags: [],
    cards_count: 0,
    is_read: false,
  }
}

describe('groupNotesByTopic', () => {
  it('расставляет группы в порядке тем блока, а не в порядке конспектов', () => {
    const notes = [note('a', 'algorithms'), note('b', 'core')]

    expect(groupNotesByTopic(TOPICS, notes).map((group) => group.slug)).toEqual([
      'core',
      'algorithms',
    ])
  })

  it('пропускает темы, в которых нет конспектов', () => {
    const groups = groupNotesByTopic(TOPICS, [note('a', 'core')])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBe('Язык и структуры данных')
  })

  it('сохраняет порядок конспектов внутри темы', () => {
    const notes = [note('first', 'core'), note('second', 'core'), note('third', 'core')]

    expect(groupNotesByTopic(TOPICS, notes)[0]?.notes.map((item) => item.slug)).toEqual([
      'first',
      'second',
      'third',
    ])
  })

  it('собирает конспекты без темы в отдельную группу в конце', () => {
    const groups = groupNotesByTopic(TOPICS, [note('bez-temy', null), note('s-temoy', 'core')])

    expect(groups.map((group) => group.slug)).toEqual(['core', null])
    expect(groups[1]?.title).toBe('Без темы')
  })

  it('не теряет конспект с темой, которой в блоке уже нет', () => {
    // Тему убрали из blocks.yaml: конспект обязан остаться в навигации.
    const groups = groupNotesByTopic(TOPICS, [note('sirota', 'udalennaya-tema')])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.slug).toBeNull()
    expect(groups[0]?.notes.map((item) => item.slug)).toEqual(['sirota'])
  })

  it('на пустом списке конспектов не даёт ни одной группы', () => {
    expect(groupNotesByTopic(TOPICS, [])).toEqual([])
  })
})

describe('flattenGroups', () => {
  it('даёт порядок бокового списка, а не исходный порядок выдачи', () => {
    // Источник сортирует по номеру файла в пределах блока, темы файлы не разделяют.
    const fromSource = [
      note('001-algo', 'algorithms'),
      note('002-core', 'core'),
      note('003-algo', 'algorithms'),
    ]

    const ordered = flattenGroups(groupNotesByTopic(TOPICS, fromSource))

    expect(ordered.map((item) => item.slug)).toEqual(['002-core', '001-algo', '003-algo'])
  })
})
