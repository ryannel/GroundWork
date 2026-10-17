import type { DrawnNode } from '@/application/plan-viz-flow-drawn';

import styles from './flow-flags.module.css';

/** The data attributes a node's shapes carry so their own style can answer to the plan's state and the lens. */
export function shapeData(node: DrawnNode) {
  return {
    'data-state': node.state,
    'data-touched': node.touched,
    'data-touch-steps': node.touchSteps.join(' '),
    'data-lens-off': node.lensOff,
  };
}

export interface FlagsProps {
  readonly w: number;
  readonly mark: string | null;
  /** `+ new` above a system the plan adds; a service says it on its header row instead. */
  readonly fresh: boolean;
}

/** The small words above a system's corner: its marker, and `+ new`. */
export function Flags({ w, mark, fresh }: FlagsProps) {
  return (
    <>
      {mark === null ? null : (
        <text className={styles.mark} textAnchor="end" x={w - 6} y={-4}>
          {mark}
        </text>
      )}
      {fresh ? (
        <text className={styles.fresh} textAnchor="end" x={w - 4} y={-5}>
          + new
        </text>
      ) : null}
    </>
  );
}
