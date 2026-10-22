import { clipText } from '@/application/plan-viz-flow-geometry';
import { LINE, ROLE_LINE, SYS_NAME } from '@/application/plan-viz-system-map-boxes';
import type { DrawnNode } from '@/application/plan-viz-system-map-types';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

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

/** A folded card's foot: the team that owns it, then how big the system is. */
function Foot({ node }: { readonly node: DrawnNode }) {
  const y = node.head + 17;
  return (
    <>
      <line className={styles.divider} x1={16} x2={node.w - 12} y1={node.head} y2={node.head} />
      {node.owner === '' ? null : (
        <text className={styles.role} x={20} y={y}>
          {clipText(node.owner, 26)}
        </text>
      )}
      <text className={styles.role} x={20} y={node.owner === '' ? y : y + ROLE_LINE}>
        {node.size}
      </text>
    </>
  );
}

/** A system: components built and run as one. Open, its parts are cards inside the frame; folded, it says what
 * the system is for, who owns it and how big it is, and the inspector names what is inside. */
export function MapSystem({ node, onFold }: MapSystemProps) {
  return (
    <>
      <rect
        className={styles.card}
        data-out={node.lens === 'out'}
        height={node.h}
        rx={11}
        width={node.w}
      />
      <MapStripe h={node.h} r={4.5} slot={node.teamSlot} />
      <Hit h={node.h} inspect={node.id} label={node.name} w={node.w} x={0} y={0} />
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
      {node.folded ? <Foot node={node} /> : null}
    </>
  );
}
