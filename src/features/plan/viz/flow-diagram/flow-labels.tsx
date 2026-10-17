import type { DrawnLabel, DrawnRow } from '@/application/plan-viz-flow-drawn';
import { LINE } from '@/application/plan-viz-flow-size';

import { Hit, stepTarget, type StepAction } from './flow-hit';
import styles from './flow-labels.module.css';

const BADGE = 7;
const LETTERED_BADGE = 9;
const TEXT_AT = { implicit: 0, lettered: 24, plain: 20 };

function textAt(row: DrawnRow): number {
  if (row.implicit) return TEXT_AT.implicit;
  return row.lettered ? TEXT_AT.lettered : TEXT_AT.plain;
}

export interface FlowLabelsProps {
  readonly labels: readonly DrawnLabel[];
  readonly action: StepAction;
}

function Row({
  label,
  row,
  action,
}: {
  readonly label: DrawnLabel;
  readonly row: DrawnRow;
  readonly action: StepAction;
}) {
  return (
    <g
      className={styles.row}
      data-implicit={row.implicit}
      data-state={row.state}
      data-walk={row.walk}
      data-walk-steps={row.steps.join(' ')}
    >
      {row.number !== null && row.first && !row.implicit ? (
        <>
          <circle
            className={styles.badge}
            cx={label.x + BADGE}
            cy={row.y}
            r={row.lettered ? LETTERED_BADGE : BADGE}
          />
          <text className={styles.number} x={label.x + BADGE} y={row.y + 0.5}>
            {row.number}
          </text>
        </>
      ) : null}
      <text className={styles.text} x={label.x + textAt(row)} y={row.y + 0.5}>
        {row.text}
        {row.mark === null ? null : (
          <tspan className={styles.mark} dx={4}>
            {row.mark}
          </tspan>
        )}
      </text>
      <title>{row.description}</title>
      <Hit
        h={LINE}
        label={row.description}
        w={label.w + 6}
        x={label.x - 3}
        y={row.y - LINE / 2 - 0.5}
        {...stepTarget(action, row.step, row.ref)}
      />
    </g>
  );
}

/** The words on the arrows: each step's reason on its own row, numbered, and picking one goes to it. */
export function FlowLabels({ labels, action }: FlowLabelsProps) {
  return (
    <g className={styles.labels}>
      {labels.map((l) => (
        <g
          key={l.key}
          data-from={l.from}
          data-kind={l.kind}
          data-steps={l.steps.join(' ')}
          data-to={l.to}
        >
          <rect
            className={styles.backing}
            height={l.h}
            rx={4}
            width={l.w + 6}
            x={l.x - 3}
            y={l.y}
          />
          {l.rows.map((row) => (
            <Row key={`${String(row.y)}:${row.text}`} action={action} label={l} row={row} />
          ))}
        </g>
      ))}
    </g>
  );
}
