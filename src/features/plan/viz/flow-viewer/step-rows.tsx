import type { Model } from '@/application/plan/derive';
import type { StepRowData } from '@/application/plan-viz-flow-narration';
import { EntityChip } from '@/features/plan/common/entity-chip';

import styles from './step-rows.module.css';

interface RowsProps {
  readonly model: Model;
  readonly rows: readonly StepRowData[];
  /** A mark beside a step, by step id. */
  readonly marks?: Readonly<Record<string, string>> | undefined;
  readonly reasons?: Readonly<Record<string, readonly string[]>> | undefined;
}

function Touches({
  model,
  word,
  ids,
}: {
  readonly model: Model;
  readonly word: string;
  readonly ids: readonly string[];
}) {
  if (ids.length === 0) return null;
  return (
    <span className={styles.touch}>
      {word}
      {ids.map((id) => (
        <EntityChip id={id} key={id} model={model} />
      ))}
    </span>
  );
}

// The steps a grouped stop holds, one line each: the number, what it does, and what it touches.
export function StepRows({ model, rows, marks, reasons }: RowsProps) {
  return (
    <ol className={styles.rows}>
      {rows.map((r) => (
        <li className={styles.row} key={r.id}>
          <span className={styles.n}>{r.n}</span>
          <span className={styles.action}>{r.action}</span>
          {r.via === null ? null : <EntityChip id={r.via} model={model} />}
          <Touches ids={r.writes} model={model} word="writes" />
          <Touches ids={r.reads} model={model} word="reads" />
          <Touches ids={r.purges} model={model} word="purges" />
          {marks?.[r.id] === undefined ? null : (
            <span className={styles.mark} title={reasons?.[r.id]?.join('\n') ?? ''}>
              {marks[r.id]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
