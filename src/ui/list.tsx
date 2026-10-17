import type { ReactNode } from 'react';

import styles from './list.module.css';

/** A framed list of rows, each ruled off from the next. Lay out the inside of a row in the feature. */
export function List({
  children,
  dense = false,
}: {
  readonly children: ReactNode;
  /** Tighter rows, for a list in a side panel. */
  readonly dense?: boolean;
}) {
  return (
    <ul className={styles.list} data-dense={dense ? '' : undefined}>
      {children}
    </ul>
  );
}

interface ListItemProps {
  readonly children: ReactNode;
  readonly chosen?: boolean;
}

export function ListItem({ children, chosen = false }: ListItemProps) {
  return (
    <li className={styles.item} data-chosen={chosen ? '' : undefined}>
      {children}
    </li>
  );
}
