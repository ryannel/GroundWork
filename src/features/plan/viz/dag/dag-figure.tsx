import type { Dag } from '@/application/plan-viz-dag';
import { PAD } from '@/application/plan-viz-dag-layout';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './dag-figure.module.css';
import { DagNodeView } from './dag-node';

const KINDS = ['plain', 'critical', 'violation'] as const;
const BAND_TOP = PAD - 8;
const STRIP = 26;

function Defs() {
  return (
    <defs>
      {KINDS.map((kind) => (
        <marker
          id={`dag-arrow-${kind}`}
          key={kind}
          markerHeight={7}
          markerWidth={7}
          orient="auto"
          refX={7}
          refY={4}
          viewBox="0 0 8 8"
        >
          <path className={styles.head} d="M0,0 L8,4 L0,8 z" data-kind={kind} />
        </marker>
      ))}
    </defs>
  );
}

function Bands({ dag }: { readonly dag: Dag }) {
  return dag.bands.map((band) => (
    <g key={band.id}>
      <rect
        className={styles.band}
        height={dag.h - PAD}
        rx={10}
        width={band.w}
        x={band.x}
        y={BAND_TOP}
      />
      <text className={styles.bandName} x={band.x + 12} y={PAD + 10}>
        <title>{band.name}</title>
        {band.shown}
      </text>
      {band.right === '' ? null : (
        <text className={styles.bandDue} x={band.x + band.w - 12} y={PAD + 10}>
          {band.right}
        </text>
      )}
      {band.ref === null ? null : (
        <Hit h={STRIP} inspect={band.ref} label={band.name} w={band.w} x={band.x} y={BAND_TOP} />
      )}
    </g>
  ));
}

/** The graph at its own size: milestone bands behind, the dependency arrows, then a card for each work item. */
export function DagFigure({ dag }: { readonly dag: Dag }) {
  return (
    <svg
      aria-label={`Dependency graph of ${String(dag.count)} work items`}
      className={styles.svg}
      height={dag.h}
      role="group"
      viewBox={`0 0 ${String(dag.w)} ${String(dag.h)}`}
      width={dag.w}
    >
      <Defs />
      <Bands dag={dag} />
      <g>
        {dag.edges.map((edge) => (
          <path
            className={styles.edge}
            d={edge.path}
            data-kind={edge.kind}
            key={edge.key}
            markerEnd={`url(#dag-arrow-${edge.kind})`}
          >
            <title>{edge.title}</title>
          </path>
        ))}
      </g>
      {dag.nodes.map((node) => (
        <DagNodeView key={node.id} node={node} />
      ))}
    </svg>
  );
}
