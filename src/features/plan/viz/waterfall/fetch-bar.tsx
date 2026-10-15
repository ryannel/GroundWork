import type { FetchBarView } from '@/application/plan-viz-waterfall-view';

import styles from './fetch-bar.module.css';

interface FetchBarProps {
  readonly bar: FetchBarView;
  /** The name of the subgraph its endpoint then calls. */
  readonly callsName: string | null;
}

const BAR = 12;
const TEXT = 26;
const pct = (n: number): string => `${String(Math.round(n * 100) / 100)}%`;

// Where a fetch sits among the round trips. Its columns are round trips, never milliseconds; its width, when the
// plan measured it, is its time against the slowest fetch in the column.
export function FetchBar({ bar, callsName }: FetchBarProps) {
  const column = 100 / bar.cols;
  const x = bar.depth * column;
  const width = (bar.share ?? 100) * (column / 100);
  const half = width / 2;
  const timed = bar.ms !== null && !bar.skipped;
  return (
    <svg
      aria-hidden="true"
      className={styles.track}
      data-skipped={bar.skipped ? '' : undefined}
      height={timed ? TEXT + 2 : BAR}
      width="100%"
    >
      {bar.ms === null ? null : (
        <title>{`about ${String(bar.ms)} ms per fetch (observed p50)`}</title>
      )}
      <rect
        className={styles.first}
        height={BAR}
        rx="3"
        width={pct(bar.calls === null ? width : half)}
        x={pct(x)}
        y="0"
      />
      {bar.calls === null ? null : (
        <rect
          className={styles.then}
          data-skipped={bar.callsSkipped ? '' : undefined}
          height={BAR}
          rx="3"
          width={pct(half)}
          x={pct(x + half)}
          y="0"
        >
          <title>{`then calls ${callsName ?? bar.calls}`}</title>
        </rect>
      )}
      {timed ? (
        <text className={styles.ms} x={pct(x)} y={TEXT}>
          {`~${String(bar.ms)} ms`}
        </text>
      ) : null}
    </svg>
  );
}
