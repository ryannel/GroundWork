import { clipText } from '@/application/plan-viz-flow-geometry';
import type { DrawnNode, DrawnRow } from '@/application/plan-viz-system-map-types';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';
import { ComponentCardHeader } from '@/ui/canvas/component-card';

import styles from './map-card.module.css';
import { kindOf } from './map-kind';
import { MapStripe } from './map-stripe';

const PORT = 4.5;

function Ports({
  w,
  cy,
  sides,
}: {
  readonly w: number;
  readonly cy: number;
  readonly sides: readonly ('L' | 'R')[];
}) {
  return sides.map((s) => (
    <circle key={s} className={styles.port} cx={s === 'L' ? 0 : w} cy={cy} r={PORT} />
  ));
}

function Row({ node, row }: { readonly node: DrawnNode; readonly row: DrawnRow }) {
  const room = (row.count > 1 ? 21 : 26) - (node.part ? 2 : 0);
  return (
    <g className={styles.row}>
      <Ports cy={row.cy} sides={row.landed} w={node.w} />
      <text className={styles.sig} x={node.tx} y={row.cy + 0.5}>
        {clipText(row.label, room)}
      </text>
      {row.count > 1 ? (
        <text className={styles.count} x={node.w - 12} y={row.cy + 0.5}>
          {row.count}
        </text>
      ) : null}
      <title>{row.tip}</title>
      <Hit h={20} inspect={row.id} label={row.tip} w={node.w} x={0} y={row.cy - 10} />
    </g>
  );
}

function Header({ node }: { readonly node: DrawnNode }) {
  const kind = kindOf(node.serviceKind);
  const inset = node.part ? 0 : 8;
  return (
    <foreignObject
      height={node.head - 2}
      pointerEvents="auto"
      width={node.w - inset}
      x={inset}
      y={0}
    >
      <ComponentCardHeader
        density="dense"
        icon={kind.icon}
        inspect={node.id}
        kind={kind.word}
        name={node.name}
        summary={node.role.join(' ')}
        tone={kind.tone}
      />
    </foreignObject>
  );
}

/** A service: its name and role, the interfaces others call it on, and where those calls land. */
export function MapCard({ node }: { readonly node: DrawnNode }) {
  const inset = node.part ? 8 : 12;
  const hasRows = node.rows.length > 0 || node.more !== null;
  return (
    <>
      <rect
        className={styles.card}
        data-external={node.external}
        data-out={node.lens === 'out'}
        data-part={node.part}
        height={node.h}
        rx={node.part ? 7 : 9}
        width={node.w}
      />
      {node.part ? null : <MapStripe h={node.h} r={3.5} slot={node.teamSlot} />}
      <Header node={node} />
      {hasRows ? (
        <line
          className={styles.divider}
          x1={inset}
          x2={node.w - inset}
          y1={node.head - 2}
          y2={node.head - 2}
        />
      ) : null}
      {node.rows.map((row) => (
        <Row key={row.id} node={node} row={row} />
      ))}
      {node.more === null ? null : (
        <g>
          <Ports cy={node.more.cy} sides={node.more.landed} w={node.w} />
          <text className={styles.sig} data-more="" x={node.tx} y={node.more.cy + 0.5}>
            {`+${String(node.more.count)} more interfaces`}
          </text>
          <title>{node.more.tip}</title>
        </g>
      )}
    </>
  );
}
