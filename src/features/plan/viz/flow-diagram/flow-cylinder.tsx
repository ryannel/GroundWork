import type { DrawnNode, StoreBody } from '@/application/plan-viz-flow-drawn';
import { CAP } from '@/application/plan-viz-flow-size';

import styles from './flow-cylinder.module.css';
import { shapeData } from './flow-flags';

const BAND = 9;

export interface FlowCylinderProps {
  readonly node: DrawnNode;
  readonly body: StoreBody;
}

/** A store, drawn as a cylinder: a lit top, a band, a curved base, its name and what kind of store it is. */
export function FlowCylinder({ node, body }: FlowCylinderProps) {
  const { w, h } = node;
  const half = w / 2;
  const shape = shapeData(node);
  const arc = `A${String(half)} ${String(CAP)} 0 0`;
  return (
    <>
      <path
        className={styles.body}
        d={`M0 ${String(CAP)} ${arc} 1 ${String(w)} ${String(CAP)} V${String(h - CAP)} ${arc} 1 0 ${String(h - CAP)} Z`}
        {...shape}
      />
      <path
        className={styles.band}
        d={`M0 ${String(CAP + BAND)} ${arc} 0 ${String(w)} ${String(CAP + BAND)}`}
      />
      <ellipse className={styles.cap} cx={half} cy={CAP} rx={half} ry={CAP} {...shape} />
      <text className={styles.name} x={half} y={CAP + 28}>
        {body.name}
      </text>
      <text className={styles.kind} x={half} y={CAP + 43}>
        {body.word}
      </text>
    </>
  );
}
