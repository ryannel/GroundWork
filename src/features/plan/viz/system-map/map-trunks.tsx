import type { DrawnTrunk } from '@/application/plan-viz-system-map-types';

import styles from './map-trunks.module.css';

export interface MapTrunksProps {
  readonly trunks: readonly DrawnTrunk[];
  /** The topics and stores whose trunk a trace lights, or null when nothing is traced. */
  readonly lit: ReadonlySet<string> | null;
}

function litOf(lit: ReadonlySet<string> | null, node: string): 'hot' | 'dim' | undefined {
  if (lit === null) return undefined;
  return lit.has(node) ? 'hot' : 'dim';
}

/** The stem that ties a topic or store to the service that keeps it. */
export function MapTrunks({ trunks, lit }: MapTrunksProps) {
  return (
    <g className={styles.trunks}>
      {trunks.map((t) => (
        <path
          key={t.node}
          className={styles.trunk}
          d={t.d}
          data-kind={t.kind}
          data-trace={litOf(lit, t.node)}
        />
      ))}
    </g>
  );
}
