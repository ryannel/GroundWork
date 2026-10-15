import type { ReactNode } from 'react';

import type { FetchChange } from '@/application/plan-viz-waterfall-compare';

import styles from './row.module.css';

interface RowProps {
  readonly kind: 'cache' | 'hinge' | 'fetch' | 'fill';
  /** hit, miss, skipped, blocked or run: a case dims a row, it never removes one. */
  readonly state?: string | undefined;
  /** The reader's team: its rows keep the accent and the rest fade. */
  readonly lens?: 'mine' | 'faded' | null | undefined;
  readonly change?: FetchChange['kind'] | null | undefined;
  /** Today's layer, shown beside the plan's struck one. */
  readonly wasToday?: boolean | undefined;
  readonly fetchId?: string | undefined;
  readonly who: ReactNode;
  readonly what: ReactNode;
  /** The third column: the cache mark, or the fetch's bar. */
  readonly track?: ReactNode;
}

// One line of a waterfall: who answers, what it does, and where it sits among the round trips.
export function Row({ kind, state, lens, change, wasToday, fetchId, who, what, track }: RowProps) {
  return (
    <li
      className={styles.row}
      data-change={change ?? undefined}
      data-fetch={fetchId}
      data-kind={kind}
      data-lens={lens ?? undefined}
      data-state={state}
      data-today={wasToday === true ? '' : undefined}
    >
      <div className={styles.who}>{who}</div>
      <div className={styles.what}>{what}</div>
      <div className={styles.track}>{track}</div>
    </li>
  );
}
