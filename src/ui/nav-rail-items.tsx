import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './nav-rail-items.module.css';

export interface RailItem {
  readonly href: string;
  readonly title: string;
  readonly current: boolean;
  /** The mark before the name; a dot by default, filled when current. */
  readonly mark?: ReactNode;
  /** A quiet count on the right. */
  readonly count?: ReactNode;
  /** The item's own parts, listed under it. */
  readonly items?: readonly RailItem[];
}

/** A group's pages, each with its mark, and under any one its own parts. */
export function RailItems({
  items,
  flat = false,
}: {
  readonly items: readonly RailItem[];
  /** Stands on its own rather than under a group's head. */
  readonly flat?: boolean;
}) {
  return (
    <ol className={styles.items} data-flat={flat ? '' : undefined}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            aria-current={item.current ? 'page' : undefined}
            className={styles.item}
            data-spy={item.href.includes('#') ? '' : undefined}
            href={item.href}
          >
            <span aria-hidden="true" className={styles.mark}>
              {item.mark ?? (item.current ? '●' : '○')}
            </span>
            <span className={styles.name}>{item.title}</span>
            {item.count === undefined ? null : (
              <span className={styles.itemCount}>{item.count}</span>
            )}
          </Link>
          {item.items === undefined || item.items.length === 0 ? null : (
            <RailItems items={item.items} />
          )}
        </li>
      ))}
    </ol>
  );
}
