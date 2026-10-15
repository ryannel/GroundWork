import type { ElementStatus } from '@/application/plan/derive-core';

import styles from './region-number.module.css';

interface RegionNumberProps {
  readonly n: number;
  /** What the plan does to the region; colours the number. Leave off for the accent. */
  readonly status?: ElementStatus | undefined;
  /** The plan removes the region: the number is struck and the tab outlined. */
  readonly gone?: boolean;
  /** Sits on the corner of its box on a picture, rather than in a list. */
  readonly corner?: boolean;
}

// The number of a region. The tab on the picture and the number in the list are the same number.
export function RegionNumber({ n, status, gone = false, corner = false }: RegionNumberProps) {
  return (
    <span
      aria-hidden="true"
      className={styles.no}
      data-corner={corner ? '' : undefined}
      data-gone={gone ? '' : undefined}
      data-status={status}
    >
      {gone ? <s>{n}</s> : n}
    </span>
  );
}
