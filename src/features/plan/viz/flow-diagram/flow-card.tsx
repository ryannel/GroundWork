import type { DrawnNode, ServiceBody } from '@/application/plan-viz-flow-drawn';
import { clipText } from '@/application/plan-viz-flow-geometry';
import { HEAD } from '@/application/plan-viz-flow-size';
import { isRinged } from '@/application/plan-viz-teams';

import { CardRows } from './flow-card-rows';
import styles from './flow-card.module.css';
import { shapeData } from './flow-flags';
import { FlowGlyph } from './flow-glyph';
import type { StepAction } from './flow-hit';

const NAME_CLIP = 26;

export interface FlowCardProps {
  readonly node: DrawnNode;
  readonly body: ServiceBody;
  readonly action: StepAction;
}

/** A service, a screen, a job or an outside party: its name and kind, the interfaces it answers on and its own steps. */
export function FlowCard({ node, body, action }: FlowCardProps) {
  const { w, h } = node;
  const rows = body.endpoints.length + body.selfs.length > 0;
  return (
    <>
      <rect className={styles.card} height={h} rx={10} width={w} {...shapeData(node)} />
      <path
        className={styles.stripe}
        d={`M4 0.5 H9 V${String(h - 0.5)} H4 A3.5 3.5 0 0 1 0.5 ${String(h - 4)} V4 A3.5 3.5 0 0 1 4 0.5 Z`}
        data-ring={isRinged(node.team)}
        data-state={node.state}
        data-team={node.team}
      />
      <text className={styles.name} x={20} y={20}>
        {clipText(node.name, NAME_CLIP)}
      </text>
      <FlowGlyph glyph={body.glyph} x={20} y={27} />
      <text className={styles.kind} x={36} y={35}>
        {body.word}
      </text>
      {node.state === 'added' ? (
        <text className={styles.fresh} textAnchor="end" x={node.w - 12} y={35}>
          + new
        </text>
      ) : null}
      {rows ? (
        <line className={styles.divider} x1={12} x2={w - 12} y1={HEAD - 4} y2={HEAD - 4} />
      ) : null}
      <CardRows action={action} endpoints={body.endpoints} selfs={body.selfs} w={w} />
    </>
  );
}
