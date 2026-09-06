import { createContext, useContext } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type Skin = 'glass' | 'grain'
export const skins: { value: Skin; label: string; blurb: string }[] = [
  { value: 'glass', label: 'Glass', blurb: 'Translucent layers over ambient color.' },
  { value: 'grain', label: 'Grain', blurb: 'Matte, textured, editorial serif display.' },
]
export const ThemeContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void; resolved: 'light' | 'dark'; skin: Skin; setSkin: (s: Skin) => void }>({
  pref: 'system', setPref: () => {}, resolved: 'dark', skin: 'glass', setSkin: () => {},
})

export const useTheme = () => useContext(ThemeContext)
