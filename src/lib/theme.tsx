import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ThemeContext, type ThemePref, type Skin } from './theme-context'
const KEY = 'gw-theme'
const SKIN_KEY = 'gw-skin'

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') return v } catch {}
    return 'system'
  })
  const [sys, setSys] = useState<'light' | 'dark'>(systemTheme)
  const [skin, setSkin] = useState<Skin>(() => {
    try { const v = localStorage.getItem(SKIN_KEY); if (v === 'grain' || v === 'glass') return v } catch {}
    return 'glass'
  })
  useEffect(() => {
    const root = document.documentElement
    if (skin === 'glass') delete root.dataset.skin
    else root.dataset.skin = skin
    try { if (skin === 'glass') localStorage.removeItem(SKIN_KEY); else localStorage.setItem(SKIN_KEY, skin) } catch {}
  }, [skin])

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

  const value = useMemo(() => ({ pref, setPref: setPrefState, resolved: pref === 'system' ? sys : pref, skin, setSkin }), [pref, sys, skin])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
