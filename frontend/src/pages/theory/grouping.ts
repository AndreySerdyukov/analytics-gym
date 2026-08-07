/** Группировка конспектов по темам блока для бокового списка раздела теории. */

import type { NoteListItem, Topic } from '../../data/types'

export interface TheoryGroup {
  /** Слаг темы или null для группы «Без темы». */
  slug: string | null
  title: string
  notes: NoteListItem[]
}

const WITHOUT_TOPIC_TITLE = 'Без темы'

/**
 * Раскладывает конспекты по темам блока.
 *
 * Порядок групп задаёт blocks.yaml, порядок внутри группы — порядок выдачи источника данных.
 * Тема без конспектов в список не попадает: пустой скелет оглавления только шумит, а полный
 * набор тем блока и так виден на хабе и на дашборде.
 *
 * Конспект без темы и конспект с темой, которой в блоке уже нет (тему убрали из blocks.yaml),
 * попадают в группу «Без темы» в конце. Потерять конспект из навигации нельзя ни при каких
 * условиях: файл в content/ есть, значит его должно быть видно.
 */
export function groupNotesByTopic(topics: Topic[], notes: NoteListItem[]): TheoryGroup[] {
  const known = new Set(topics.map((topic) => topic.slug))
  const groups: TheoryGroup[] = []

  for (const topic of topics) {
    const inTopic = notes.filter((note) => note.topic_slug === topic.slug)
    if (inTopic.length > 0) groups.push({ slug: topic.slug, title: topic.title, notes: inTopic })
  }

  const orphans = notes.filter((note) => !note.topic_slug || !known.has(note.topic_slug))
  if (orphans.length > 0) {
    groups.push({ slug: null, title: WITHOUT_TOPIC_TITLE, notes: orphans })
  }

  return groups
}

/**
 * Линейный порядок конспектов такой, каким его видит читатель в боковом списке.
 *
 * Он не совпадает с порядком выдачи источника: там сортировка по номеру файла в пределах
 * блока, а темы файлы не разделяют. Кнопка «дальше» обязана идти по порядку списка, иначе
 * читатель прыгает между темами.
 */
export function flattenGroups(groups: TheoryGroup[]): NoteListItem[] {
  return groups.flatMap((group) => group.notes)
}
