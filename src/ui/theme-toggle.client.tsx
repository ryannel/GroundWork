'use client';

import { useSyncExternalStore } from 'react';

import styles from './theme-toggle.module.css';

const STORAGE_KEY = 'groundwork.theme';
const ORDER = ['system', 'light', 'dark'] as const;
type Theme = (typeof ORDER)[number];

const NAMES: Record<Theme, string> = {
  system: 'follow the system',
  light: 'light',
  dark: 'dark',
};

const GLYPHS: Record<Theme, readonly string[]> = {
  system: ['M2 3.5h12v8H2z', 'M6 14h4M8 11.5V14'],
  light: [
    'M8 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z',
    'M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06',
  ],
  dark: ['M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z'],
};

const listeners = new Set<() => void>();

function isTheme(value: string | null): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function chooseTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies to this page.
  }
  for (const listener of listeners) listener();
}

function nextTheme(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';
}

// One button that steps through system, light and dark, showing the current choice and remembering it in this
// browser. The root layout applies the stored choice before paint.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as const);
  const label = `Theme: ${NAMES[theme]}. Switch to ${NAMES[nextTheme(theme)]}`;
  return (
    <button
      aria-label={label}
      className={styles.toggle}
      onClick={() => {
        chooseTheme(nextTheme(theme));
      }}
      title={label}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15">
        {GLYPHS[theme].map((d) => (
          <path d={d} key={d} />
        ))}
      </svg>
    </button>
  );
}
