import type { ReactNode } from 'react';

import styles from './badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'added' | 'modified' | 'deprecated' | 'removed';

interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
