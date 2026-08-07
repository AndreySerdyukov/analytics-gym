import { useCallback } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { ErrorBox, Loader } from './components/ui'
import { useAsync } from './data/useAsync'
import { BlockHubPage } from './pages/BlockHubPage'
import { DashboardPage } from './pages/DashboardPage'
import { PracticePage } from './pages/PracticePage'
import { ReviewPage } from './pages/ReviewPage'
import { StatsPage } from './pages/StatsPage'
import { TaskPage } from './pages/TaskPage'
import { LegacyNoteRedirect } from './pages/theory/LegacyNoteRedirect'
import { NoteView } from './pages/theory/NoteView'
import { TheoryIntro } from './pages/theory/TheoryIntro'
import { TheoryLayout } from './pages/theory/TheoryLayout'

/** Значение подставляется на этапе сборки: 'api' для dev/build, 'static' для demo-билда. */
declare const __DATA_SOURCE__: 'api' | 'static'

// GitHub Pages отдаёт только статику и не умеет возвращать index.html на произвольный путь,
// поэтому в демо маршруты живут в хеше (/#/t/slug). Локально — обычные адреса.
const Router = __DATA_SOURCE__ === 'static' ? HashRouter : BrowserRouter

export function App() {
  // Блоки и счётчик повторений нужны шапке на всех страницах — грузим на верхнем уровне.
  const blocks = useAsync((source) => source.listBlocks(), [])
  const review = useAsync((source) => source.reviewSummary(), [])

  // Решённая задача меняет счётчики блоков, оценённая карточка — очередь повторения.
  const reloadBlocks = useCallback(() => blocks.reload(), [blocks])
  const reloadReview = useCallback(() => review.reload(), [review])

  return (
    <Router>
      <Header blocks={blocks.data ?? []} dueToday={review.data?.due_today ?? 0} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Полноэкранный лоадер нужен только при первой загрузке: reload() держит старые
            данные, и без этой проверки отметка о прочтении сбрасывала бы весь экран. */}
        {blocks.loading && !blocks.data && <Loader label="Загружаем блоки" />}
        {blocks.error && <ErrorBox message={blocks.error} onRetry={blocks.reload} />}
        {blocks.data && (
          <Routes>
            <Route
              path="/"
              element={<DashboardPage blocks={blocks.data} dueToday={review.data?.due_today ?? 0} />}
            />
            <Route path="/b/:blockSlug" element={<BlockHubPage blocks={blocks.data} />} />
            <Route path="/b/:blockSlug/practice" element={<PracticePage blocks={blocks.data} />} />
            <Route
              path="/b/:blockSlug/theory"
              element={<TheoryLayout blocks={blocks.data} onNoteRead={reloadBlocks} />}
            >
              <Route index element={<TheoryIntro />} />
              <Route path=":noteSlug" element={<NoteView />} />
            </Route>
            <Route path="/t/:taskSlug" element={<TaskPage onProgressChange={reloadBlocks} />} />
            {/* Теория переехала внутрь блоков. Старые адреса живут ради закладок и ссылок на демо. */}
            <Route path="/theory" element={<Navigate to="/" replace />} />
            <Route path="/theory/:noteSlug" element={<LegacyNoteRedirect />} />
            <Route path="/review" element={<ReviewPage onReviewed={reloadReview} />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </Router>
  )
}
