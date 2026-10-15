import type { DrawnEdge, FlowDiagramData } from '@/application/plan-viz-flow-drawn';

import styles from './flow-edges.module.css';
import { Hit } from './flow-hit';

const REACH = 5;

export interface FlowEdgesProps {
  readonly edges: readonly DrawnEdge[];
}

function Segments({ edge }: { readonly edge: DrawnEdge }) {
  return edge.pts.slice(1).map((p, k) => {
    const [x0, y0] = edge.pts[k] ?? p;
    const [x1, y1] = p;
    return (
      <Hit
        key={`${String(x0)},${String(y0)}`}
        h={Math.abs(y1 - y0) + 2 * REACH}
        inspect={edge.ref}
        label={edge.aria}
        w={Math.abs(x1 - x0) + 2 * REACH}
        x={Math.min(x0, x1) - REACH}
        y={Math.min(y0, y1) - REACH}
      />
    );
  });
}

/** The arrows between systems: solid for a call, dashed for an event, dotted for data; each opens what it carries. */
export function FlowEdges({ edges }: FlowEdgesProps) {
  return (
    <g className={styles.edges}>
      {edges.map((e) => (
        <g
          key={e.key}
          className={styles.edge}
          data-from={e.from}
          data-implicit={e.implicit}
          data-kind={e.kind}
          data-state={e.state}
          data-steps={e.steps.join(' ')}
          data-to={e.to}
          data-walk={e.walk}
        >
          <path className={styles.line} d={e.d} />
          <path className={styles.head} d={e.head} />
          <title>{e.title}</title>
          <Segments edge={e} />
        </g>
      ))}
    </g>
  );
}

/** The small rings where a calling service's arrows leave it; drawn over the systems. */
export function FlowPorts({ ports }: { readonly ports: FlowDiagramData['ports'] }) {
  return (
    <g className={styles.ports}>
      {ports.map((p) => (
        <circle key={p.id} className={styles.port} cx={p.x} cy={p.y} r={5} />
      ))}
    </g>
  );
}
