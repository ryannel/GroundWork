import type { ReactNode } from 'react';

import styles from './callout.module.css';

interface CalloutProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly tone?: 'note' | 'warning';
}

export function Callout({ children, title, tone = 'note' }: CalloutProps) {
  return (
    <aside className={styles.callout} data-tone={tone}>
      {title === undefined ? null : <p className={styles.title}>{title}</p>}
      {children}
    </aside>
  );
}
