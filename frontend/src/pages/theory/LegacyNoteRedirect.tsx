/**
 * Старый адрес конспекта /theory/:noteSlug ведёт на его новое место внутри блока.
 *
 * Блок нельзя вытащить из слага разбором строки: слаг устроен как `<block>-<имя файла>`, а
 * `stats-ab` сам содержит дефис, и `stats-ab-proverka-gipotez` разбирается неоднозначно.
 * Поэтому блок спрашиваем у источника данных.
 */

import { Navigate, useParams } from 'react-router-dom'
import { Loader } from '../../components/ui'
import { useAsync } from '../../data/useAsync'

export function LegacyNoteRedirect() {
  const { noteSlug = '' } = useParams()
  const note = useAsync((source) => source.getNote(noteSlug), [noteSlug])

  if (note.loading) return <Loader label="Открываем конспект" />
  // Ссылка могла устареть вместе с самим конспектом: молча ведём на главную, как catch-all.
  if (note.error || !note.data) return <Navigate to="/" replace />

  // replace обязателен: иначе «назад» возвращает сюда и тут же уводит вперёд снова.
  return <Navigate to={`/b/${note.data.block_slug}/theory/${note.data.slug}`} replace />
}
