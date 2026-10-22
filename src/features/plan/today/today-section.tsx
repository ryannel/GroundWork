import type { ReactNode } from 'react';

import styles from './today-section.module.css';

interface SectionProps {
  readonly title: string;
  /** How many the section lists, beside its title. */
  readonly count?: number;
  readonly children: ReactNode;
}

/** One section of a thing's page: a rule, a quiet title, and what it holds. */
export function Section({ title, count, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        {title}
        {count === undefined ? null : <span className={styles.count}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}
