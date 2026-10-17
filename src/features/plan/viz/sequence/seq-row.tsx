import type { ReactNode } from 'react';

import type { SeqGut } from '@/application/plan-viz-sequence-cells';

import { Gutter } from './seq-gutter';
import { Lanes } from './seq-lanes';
import styles from './seq-row.module.css';

interface RowProps {
  readonly kind: 'step' | 'link' | 'trigger' | 'group' | 'else';
  readonly gut: readonly SeqGut[];
  /** The step number, from 1. */
  readonly n?: number;
  /** The step a viewer goes to when the row is picked. */
  readonly go?: number | undefined;
  readonly walk?: 'current' | 'walked' | '';
  /** The step's index, so its walk can follow whichever stop a viewer shows. */
  readonly at?: number | undefined;
  readonly status?: string;
  readonly isNew?: boolean;
  readonly act?: ReactNode;
  readonly children?: ReactNode;
}

/** One row of the drawing: the test brackets, the step number, the words, and the lane strip with what is drawn on it. */
export function Row({
  kind,
  gut,
  n,
  go,
  walk = '',
  at,
  status = 'existing',
  isNew = false,
  act,
  children,
}: RowProps) {
  return (
    <div
      className={styles.row}
      data-kind={kind}
      data-new={isNew ? '' : undefined}
      data-status={status}
      data-step={go}
      data-walk={walk === '' ? undefined : walk}
      data-walk-at={at}
    >
      <div className={styles.gut}>
        <Gutter marks={gut} />
      </div>
      <div className={styles.idx}>{n}</div>
      <div className={styles.act}>{act}</div>
      <div className={styles.lanes}>
        <Lanes>{children}</Lanes>
      </div>
    </div>
  );
}
