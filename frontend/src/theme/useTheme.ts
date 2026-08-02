/** Переключение светлой и тёмной темы. Выбор запоминается в localStorage. */

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'gym-theme'

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  // Начальное значение уже проставлено инлайн-скриптом в index.html, чтобы не мигал фон.
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Приватный режим: тема просто не запомнится между сессиями.
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
