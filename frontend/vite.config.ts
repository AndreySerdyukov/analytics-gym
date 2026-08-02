import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Два режима сборки:
//   dev/build — полное приложение, данные из FastAPI (VITE_DATA_SOURCE=api);
//   demo      — статичная витрина для GitHub Pages, данные из content.json (VITE_DATA_SOURCE=static).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // PGlite поставляет .wasm и .data — оптимизатор Vite их ломает, поэтому исключаем.
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  // Воркер с PGlite должен собираться как ES-модуль: в формате iife production-сборка падает.
  worker: {
    format: 'es',
  },
  // На GitHub Pages сайт живёт в подкаталоге с именем репозитория. База должна быть
  // абсолютной: с относительной './' запрос content.json со страницы /t/slug ушёл бы
  // в /t/content.json. Переопределяется через VITE_BASE, если имя репозитория другое.
  base: mode === 'demo' ? (process.env.VITE_BASE ?? '/analytics-gym/') : '/',
  define: {
    __DATA_SOURCE__: JSON.stringify(mode === 'demo' ? 'static' : 'api'),
  },
  server: {
    port: 5173,
    // Фронт ходит на относительный /api — проксируем на локальный бэкенд,
    // чтобы в браузере не было CORS и адрес API не хардкодился в коде.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}))
