import { useState, useEffect, useCallback, useMemo } from 'react'

type Theme = 'dark' | 'light' | 'system'

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyToDOM(effective: 'dark' | 'light') {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(effective)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  // Derive resolved theme synchronously (no effect needed)
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme])

  // Apply to DOM whenever resolvedTheme changes
  applyToDOM(resolvedTheme)

  // Set theme
  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem('theme', newTheme)
    setThemeState(newTheme)
  }, [])

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }, [resolvedTheme, setTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handler = () => {
      // Re-trigger render so useMemo recalculates
      setThemeState('system')
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
  }
}
