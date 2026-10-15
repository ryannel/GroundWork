import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './app-bar.module.css';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle.client';

interface Crumb {
  readonly label: string;
  readonly href: string;
}

interface AppBarProps {
  /** The pages above this one, outermost first. */
  readonly trail?: readonly Crumb[];
  /** The name of what this page is about. */
  readonly title?: string;
  /** A quiet note after the title, such as a version. */
  readonly note?: string | undefined;
  /** Actions before the theme, such as search. */
  readonly children?: ReactNode;
}

// The bar across the top of every page: the brand, the trail to where you are, the page's name, then actions.
export function AppBar({ trail = [], title, note, children }: AppBarProps) {
  return (
    <header className={styles.bar}>
      <Brand />
      {trail.length === 0 ? null : (
        <nav aria-label="Trail" className={styles.trail}>
          <ol className={styles.crumbs}>
            {trail.map((crumb) => (
              <li className={styles.crumb} key={crumb.href}>
                <Link href={crumb.href}>{crumb.label}</Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <p className={styles.title}>
        {title}
        {note === undefined ? null : <span className={styles.note}> {note}</span>}
      </p>
      <div className={styles.actions}>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
