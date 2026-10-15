import { clipText } from '@/application/plan-viz-flow-geometry';
import { LINE, PART_ROW, ROLE_LINE, SYS_NAME } from '@/application/plan-viz-system-map-boxes';
import type { DrawnNode, DrawnPart } from '@/application/plan-viz-system-map-types';
import { FlowGlyph } from '@/features/plan/viz/flow-diagram/flow-glyph';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import { kindOf } from './map-kind';
import { MapStripe } from './map-stripe';
import styles from './map-system.module.css';

const FOLD_W = 24;
const FOLD_H = 22;

export interface MapSystemProps {
  readonly node: DrawnNode;
  readonly onFold: (id: string) => void;
}

function Fold({ node, onFold }: MapSystemProps) {
  const open = !node.folded;
  const x = node.w - 28;
  const chevron = open
    ? `M${String(node.w - 20)} 11 l4 4 l4 -4`
    : `M${String(node.w - 18)} 10 l4 4 l-4 4`;
  const label = `${open ? 'Fold' : 'Unfold'} the parts of ${node.name}`;
  return (
    <>
      <path className={styles.chevron} d={chevron} />
      <foreignObject height={FOLD_H} pointerEvents="auto" width={FOLD_W} x={x} y={3}>
        <button
          aria-expanded={open}
          aria-label={label}
          className={styles.fold}
          onClick={() => {
            onFold(node.id);
          }}
          title={open ? 'Fold this system to one card' : 'Show each part of this system'}
          type="button"
        />
      </foreignObject>
    </>
  );
}

function PartRow({
  part,
  at,
  w,
}: {
  readonly part: DrawnPart;
  readonly at: number;
  readonly w: number;
}) {
  return (
    <g className={styles.part}>
      <FlowGlyph glyph={kindOf(part.kind).glyph} x={20} y={at - 5} />
      <text className={styles.partName} x={34} y={at + 0.5}>
        {clipText(part.label, 24)}
      </text>
      <title>{part.tip}</title>
      <Hit h={PART_ROW} inspect={part.id} label={part.tip} w={w} x={0} y={at - PART_ROW / 2} />
    </g>
  );
}

/** A system: components built and run as one. Open, its parts are cards inside the frame; folded, it lists them. */
export function MapSystem({ node, onFold }: MapSystemProps) {
  const count = node.parts.length;
  const first = node.head;
  return (
    <>
      <rect className={styles.card} height={node.h} rx={11} width={node.w} />
      <MapStripe h={node.h} r={4.5} slot={node.teamSlot} />
      <Hit h={node.h} inspect={node.id} label={node.name} w={node.w} x={0} y={0} />
      <FlowGlyph glyph="⧉" x={20} y={9} />
      <text className={styles.eyebrow} x={34} y={14.5}>
        {`SYSTEM · ${String(count)} ${count === 1 ? 'PART' : 'PARTS'}`}
      </text>
      {node.lines.map((t, i) => (
        <text key={t} className={styles.name} x={20} y={SYS_NAME + i * LINE}>
          {t}
        </text>
      ))}
      {node.role.map((t, i) => (
        <text key={t} className={styles.role} x={20} y={node.nameEnd + 2 + (i + 1) * ROLE_LINE}>
          {t}
        </text>
      ))}
      <Fold node={node} onFold={onFold} />
      {node.folded ? (
        <>
          <line className={styles.divider} x1={16} x2={node.w - 12} y1={first - 5} y2={first - 5} />
          {node.parts.map((p, i) => (
            <PartRow key={p.id} at={first + i * PART_ROW + PART_ROW / 2 - 1} part={p} w={node.w} />
          ))}
        </>
      ) : null}
    </>
  );
}
