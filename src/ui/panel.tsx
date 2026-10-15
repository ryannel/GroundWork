import type { ReactNode } from 'react';

import styles from './panel.module.css';

interface PanelProps {
  readonly children: ReactNode;
  readonly title?: string;
}

export function Panel({ children, title }: PanelProps) {
  return (
    <section className={styles.panel}>
      {title === undefined ? null : <h3 className={styles.title}>{title}</h3>}
      {children}
    </section>
  );
}
