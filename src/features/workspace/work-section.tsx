import type { ReactNode } from 'react';

import { SectionHeading } from '@/ui/section-heading';

import styles from './work-section.module.css';

/** One section of a page about work across plans: a heading, a line on how to read it, then what it holds. */
export function WorkSection({
  title,
  says,
  children,
}: {
  readonly title: string;
  readonly says: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={title} className={styles.section}>
      <SectionHeading title={title}>
        <p>{says}</p>
      </SectionHeading>
      {children}
    </section>
  );
}
