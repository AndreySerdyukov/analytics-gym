import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { ErrorBox, Loader } from './components/ui'
import { useAsync } from './data/useAsync'
import { BlockPage } from './pages/BlockPage'
import { DashboardPage } from './pages/DashboardPage'
import { TaskPage } from './pages/TaskPage'

/** Значение подставляется на этапе сборки: 'api' для dev/build, 'static' для demo-билда. */
declare const __DATA_SOURCE__: 'api' | 'static'

// GitHub Pages отдаёт только статику и не умеет возвращать index.html на произвольный путь,
// поэтому в демо маршруты живут в хеше (/#/t/slug). Локально — обычные адреса.
const Router = __DATA_SOURCE__ === 'static' ? HashRouter : BrowserRouter

export function App() {
  // Блоки нужны и шапке, и дашборду — грузим один раз на верхнем уровне.
  const blocks = useAsync((source) => source.listBlocks(), [])

  return (
    <Router>
      <Header blocks={blocks.data ?? []} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {blocks.loading && <Loader label="Загружаем блоки" />}
        {blocks.error && <ErrorBox message={blocks.error} onRetry={blocks.reload} />}
        {blocks.data && (
          <Routes>
            <Route path="/" element={<DashboardPage blocks={blocks.data} />} />
            <Route path="/b/:blockSlug" element={<BlockPage blocks={blocks.data} />} />
            <Route path="/t/:taskSlug" element={<TaskPage onProgressChange={blocks.reload} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </Router>
  )
}
