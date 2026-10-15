import type { DrawnNode } from '@/application/plan-viz-system-map-types';

import { MapCard } from './map-card';
import styles from './map-node.module.css';
import { MapSatellite } from './map-satellite';
import { MapSystem } from './map-system';

export interface MapNodeProps {
  readonly node: DrawnNode;
  /** Some lines are filtered out and this card has none of the kind that is left. */
  readonly muted: boolean;
  /** Lit while a card or line is traced: true if it is part of the trace, false if it fades. */
  readonly lit: boolean | null;
  readonly onFold: (id: string) => void;
}

function traceOf(lit: boolean | null): 'hot' | 'dim' | undefined {
  if (lit === null) return undefined;
  return lit ? 'hot' : 'dim';
}

function Body({ node, onFold }: Pick<MapNodeProps, 'node' | 'onFold'>) {
  if (node.kind === 'system') return <MapSystem node={node} onFold={onFold} />;
  if (node.kind === 'service') return <MapCard node={node} />;
  return <MapSatellite node={node} />;
}

/** One card, system, topic or store, placed where the layout put it. */
export function MapNode({ node, muted, lit, onFold }: MapNodeProps) {
  return (
    <g
      className={styles.node}
      data-kind={node.kind}
      data-lens={node.lens ?? undefined}
      data-muted={muted}
      data-node={node.id}
      data-trace={traceOf(lit)}
      transform={`translate(${String(node.x)} ${String(node.y)})`}
    >
      <Body node={node} onFold={onFold} />
      <title>{node.tip}</title>
    </g>
  );
}
