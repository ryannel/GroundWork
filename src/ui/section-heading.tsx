import type { ReactNode } from 'react';

import styles from './section-heading.module.css';

interface SectionHeadingProps {
  /** A short noun: what the section holds. */
  readonly title: string;
  /** One quiet line on how to read it. */
  readonly children?: ReactNode;
}

export function SectionHeading({ title, children }: SectionHeadingProps) {
  return (
    <header className={styles.heading}>
      <h2 className={styles.title}>{title}</h2>
      {children === undefined ? null : <div className={styles.description}>{children}</div>}
    </header>
  );
}
