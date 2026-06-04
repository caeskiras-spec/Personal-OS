'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext({ theme: 'system', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

/** Apply resolved theme (dark|light) to <html data-theme="..."> */
function applyTheme(resolved) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved)
  }
}

/** Resolve 'system' to 'dark' or 'light' based on OS preference */
function resolveTheme(mode) {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light'
  }
  return mode
}

export function ThemeContextProvider({ children, userId, profileRepo }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'system'
    return localStorage.getItem('theme') || 'system'
  })

  // Apply on mount and when theme changes
  useEffect(() => {
    applyTheme(resolveTheme(theme))
  }, [theme])

  // Listen for OS preference change when in system mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(resolveTheme('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Sync from profile on first load (after auth)
  useEffect(() => {
    if (!userId || !profileRepo) return
    profileRepo.get(userId).then(p => {
      if (p?.theme && !localStorage.getItem('theme')) {
        setThemeState(p.theme)
      }
    }).catch(() => {})
  }, [userId, profileRepo])

  const setTheme = useCallback((mode) => {
    setThemeState(mode)
    localStorage.setItem('theme', mode)
    applyTheme(resolveTheme(mode))
    // Persist to DB in background (non-blocking)
    if (userId && profileRepo) {
      profileRepo.upsert(userId, { theme: mode }).catch(() => {})
    }
  }, [userId, profileRepo])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved: resolveTheme(theme) }}>
      {children}
    </ThemeContext.Provider>
  )
}
