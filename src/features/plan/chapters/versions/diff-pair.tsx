import type { DiffRun } from '@/application/plan-story-versions-diff';
import type { BeforeAfter, Side } from '@/application/plan-story-versions-marks';

import styles from './diff-pair.module.css';

function keyed(runs: readonly DiffRun[]) {
  let at = 0;
  return runs.map((run) => {
    const key = `${run.mark}${String(at)}`;
    at += run.text.length;
    return { ...run, key };
  });
}

function Runs({ runs }: { readonly runs: readonly DiffRun[] }) {
  if (runs.length === 0) return <span className={styles.none}>none</span>;
  return (
    <>
      {keyed(runs).map((run) => {
        if (run.mark === 'ins') return <ins key={run.key}>{run.text}</ins>;
        if (run.mark === 'del') return <del key={run.key}>{run.text}</del>;
        return <span key={run.key}>{run.text}</span>;
      })}
    </>
  );
}

function Half({ side, tone }: { readonly side: Side; readonly tone: 'was' | 'now' }) {
  return (
    <div className={styles.half} data-tone={tone}>
      <span className={styles.version}>{side.label}</span>
      <span>
        <Runs runs={side.runs} />
      </span>
    </div>
  );
}

/** A value in the old version and in the new, with the words that changed marked. */
export function DiffPair({ diff }: { readonly diff: BeforeAfter }) {
  return (
    <div className={styles.pair}>
      <Half side={diff.was} tone="was" />
      <Half side={diff.now} tone="now" />
    </div>
  );
}
