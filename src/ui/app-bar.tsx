import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './app-bar.module.css';
import { BarActions } from './bar-actions.client';
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
  /** Things that belong to the title, such as a switch to another plan. */
  readonly after?: ReactNode;
  /** Actions before the theme, such as search. On a narrow window they fold behind a More button. */
  readonly children?: ReactNode;
  /** Before the brand, such as the button that opens the rail on a phone. */
  readonly lead?: ReactNode;
}

const NO_TRAIL: NonNullable<AppBarProps['trail']> = [];

// The bar across the top of every page: the brand, the trail to where you are, the page's name, then actions.
export function AppBar({ trail = NO_TRAIL, title, note, after, children, lead }: AppBarProps) {
  return (
    <header className={styles.bar}>
      {lead}
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
      {after}
      <BarActions>
        {children}
        <ThemeToggle />
      </BarActions>
    </header>
  );
}
