import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ThemeContext, type ThemePref } from './theme-context'
// public/theme-init.js applies the same key and values before first paint; keep them in sync.
const KEY = 'gw-theme'

function storedPref(): ThemePref {
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') return v } catch {}
  return 'system'
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(storedPref)
  const [sys, setSys] = useState<'light' | 'dark'>(systemTheme)
  // Keep other open tabs in sync with a change made here.
  useEffect(() => {
    const on = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) setPrefState(storedPref())
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSys(systemTheme())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (pref === 'system') delete root.dataset.theme
    else root.dataset.theme = pref
    try { if (pref === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref) } catch {}
  }, [pref])

  const value = useMemo(() => ({ pref, setPref: setPrefState, resolved: pref === 'system' ? sys : pref }), [pref, sys])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
