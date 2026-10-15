import type { ReactNode } from 'react';

import styles from './part-section.module.css';

interface PartSectionProps {
  readonly title: string;
  /** Something here is late or low and wants attention. */
  readonly warn?: boolean;
  readonly children: ReactNode;
}

// One block of a team's page: a small heading over its content.
export function PartSection({ title, warn = false, children }: PartSectionProps) {
  return (
    <section className={styles.section} data-warn={warn ? '' : undefined}>
      <h3 className={styles.heading}>{title}</h3>
      {children}
    </section>
  );
}
