import type { ReactNode } from 'react';

import styles from './app-bar.module.css';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle.client';

interface AppBarProps {
  /** The trail to this page, if any. */
  readonly children?: ReactNode;
}

// The bar across the top of every page outside a plan: the brand, where you are, and the theme.
export function AppBar({ children }: AppBarProps) {
  return (
    <header className={styles.bar}>
      <Brand />
      <div className={styles.middle}>{children}</div>
      <ThemeToggle />
    </header>
  );
}
