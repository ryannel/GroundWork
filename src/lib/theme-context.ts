import { createContext, useContext } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export const ThemeContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void; resolved: 'light' | 'dark' }>({
  pref: 'system', setPref: () => {}, resolved: 'dark',
})

export const useTheme = () => useContext(ThemeContext)
