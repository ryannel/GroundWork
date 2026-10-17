import type { ReactNode } from 'react';

import styles from './stack.module.css';

type Gap = 0 | 1 | 2 | 3 | 4 | 6;
type Element = 'div' | 'span' | 'section' | 'header';

interface StackProps {
  readonly children: ReactNode;
  readonly gap?: Gap;
  readonly as?: Element;
  /** Names a section for screen readers. */
  readonly label?: string;
}

interface ClusterProps extends StackProps {
  readonly align?: 'start' | 'center' | 'baseline';
  /** Pushes the first and last apart, as a title and its close button. */
  readonly spread?: boolean;
}

/** Things one under another, a step apart. */
export function Stack({ children, gap = 2, as: As = 'div', label }: StackProps) {
  return (
    <As aria-label={label} className={styles.stack} data-gap={gap}>
      {children}
    </As>
  );
}

/** Things side by side that wrap when the line runs out. */
export function Cluster({
  children,
  gap = 2,
  as: As = 'div',
  label,
  align = 'center',
  spread = false,
}: ClusterProps) {
  return (
    <As
      aria-label={label}
      className={styles.cluster}
      data-align={align}
      data-gap={gap}
      data-spread={spread ? '' : undefined}
    >
      {children}
    </As>
  );
}
