import type { ReactNode } from 'react';

import styles from './empty-state.module.css';

/** A screen with nothing to draw says so, and what its author adds. */
export function EmptyState({ children }: { readonly children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
