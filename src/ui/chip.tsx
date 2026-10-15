import type { ReactNode } from 'react';

import styles from './chip.module.css';

export type ChipStatus = 'existing' | 'added' | 'modified' | 'deprecated' | 'removed';

interface ChipProps {
  /** The id the inspector opens when the chip is clicked. */
  readonly id: string;
  readonly label: string;
  /** A type glyph such as ▣ or ⇄; type is told by glyph, never by colour. */
  readonly glyph?: string;
  readonly status?: ChipStatus;
  readonly mono?: boolean;
  readonly children?: ReactNode;
}

// A chip names one thing. One client inspector catches clicks on data-inspect.
export function Chip({ id, label, glyph, status = 'existing', mono = false, children }: ChipProps) {
  return (
    <button
      className={styles.chip}
      data-mono={mono ? '' : undefined}
      data-inspect={id}
      data-status={status}
      type="button"
    >
      {glyph === undefined ? null : (
        <span aria-hidden="true" className={styles.glyph}>
          {glyph}
        </span>
      )}
      <span className={styles.label}>{label}</span>
      {children}
    </button>
  );
}

export function ChipList({ children }: { readonly children: ReactNode }) {
  return <span className={styles.list}>{children}</span>;
}
