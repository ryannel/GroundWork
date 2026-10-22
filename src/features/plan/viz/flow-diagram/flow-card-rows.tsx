import type { DrawnEndpoint, DrawnSelf } from '@/application/plan-viz-flow-drawn';
import { ROW } from '@/application/plan-viz-flow-size';

import styles from './flow-card-rows.module.css';
import { Hit, stepTarget, type StepAction } from './flow-hit';

const SELF_LINE = 14;

export interface RowsProps {
  readonly w: number;
  readonly endpoints: readonly DrawnEndpoint[];
  readonly selfs: readonly DrawnSelf[];
  readonly action: StepAction;
}

/** The interfaces a service answers on, and the steps it does inside itself, one row each. */
export function CardRows({ w, endpoints, selfs, action }: RowsProps) {
  return (
    <>
      {endpoints.map((ep) => (
        <g key={`${ep.via}@${String(ep.cy)}`} className={styles.endpoint} data-added={ep.added}>
          <circle className={styles.port} cx={0} cy={ep.cy} r={6} />
          {ep.protocol === null ? null : (
            <g>
              <rect
                className={styles.num}
                height={14}
                rx={3}
                width={ep.tagW - 4}
                x={14}
                y={ep.cy - 7}
              />
              <text className={styles.numText} x={14 + (ep.tagW - 4) / 2} y={ep.cy + 0.5}>
                {ep.protocol}
              </text>
            </g>
          )}
          <text className={styles.sig} x={16 + ep.tagW} y={ep.cy + 0.5}>
            {ep.text}
          </text>
          <title>{ep.title}</title>
          <Hit h={ROW} inspect={ep.via} label={ep.aria} w={w} x={0} y={ep.cy - ROW / 2} />
        </g>
      ))}
      {selfs.map((s) => (
        <g
          key={s.id}
          className={styles.self}
          data-state={s.state}
          data-walk={s.walk}
          data-walk-steps={s.step}
        >
          <rect className={styles.num} height={14} rx={3} width={14} x={14} y={s.cy - 7} />
          <text className={styles.numText} x={21} y={s.cy + 0.5}>
            {s.step + 1}
          </text>
          {s.lines.map((line, k) => (
            <text key={line} className={styles.text} x={36} y={s.cy + 0.5 + k * SELF_LINE}>
              {line}
              {k === s.lines.length - 1 && s.mark !== null ? (
                <tspan className={styles.mark} dx={4}>
                  {s.mark}
                </tspan>
              ) : null}
            </text>
          ))}
          <title>{s.title}</title>
          <Hit
            h={ROW + (s.lines.length - 1) * SELF_LINE}
            label={s.aria}
            w={w}
            x={0}
            y={s.cy - ROW / 2}
            {...stepTarget(action, s.step, s.id)}
          />
        </g>
      ))}
    </>
  );
}
