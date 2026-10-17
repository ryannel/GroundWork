import type { ReactNode } from 'react';

import { Text } from '@/ui/text';

import styles from './specimen.module.css';

interface SpecimenProps {
  readonly name: string;
  /** When to reach for it. */
  readonly use: string;
  readonly children: ReactNode;
}

// One primitive, what it is for, and how it looks.
export function Specimen({ name, use, children }: SpecimenProps) {
  return (
    <section className={styles.specimen}>
      <div className={styles.about}>
        <Text as="h3" tone="strong" weight="strong">
          {name}
        </Text>
        <Text as="p" size="sm" tone="muted">
          {use}
        </Text>
      </div>
      <div className={styles.show}>{children}</div>
    </section>
  );
}
