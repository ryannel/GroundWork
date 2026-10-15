import type { DrawnLine } from '@/application/plan-viz-system-map-types';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './map-edges.module.css';
import type { LineFilter } from './use-system-map';

const HEAD = 8;
const FLANK = 4.5;
const BUTTON = 16;

export interface MapEdgesProps {
  readonly lines: readonly DrawnLine[];
  readonly filter: LineFilter;
  /** The keys of the lines a trace lights, or null when nothing is traced. */
  readonly lit: ReadonlySet<string> | null;
}

function Head({ line }: { readonly line: DrawnLine }) {
  const { tx, ty, into } = line;
  if (line.kind === 'data') return <circle className={styles.head} cx={tx} cy={ty} r={2.5} />;
  const back = tx - into * HEAD;
  return (
    <path
      className={styles.head}
      d={`M${String(tx)} ${String(ty)} L${String(back)} ${String(ty - FLANK)} L${String(back)} ${String(ty + FLANK)} Z`}
    />
  );
}

function litOf(lit: ReadonlySet<string> | null, key: string): 'hot' | 'dim' | undefined {
  if (lit === null) return undefined;
  return lit.has(key) ? 'hot' : 'dim';
}

/** The lines between cards: solid for a call, dashed for an event, dotted for data; each opens what it carries. */
export function MapEdges({ lines, filter, lit }: MapEdgesProps) {
  return (
    <g className={styles.edges}>
      {lines.map((l) => (
        <g
          key={l.key}
          className={styles.edge}
          data-dim={l.dim}
          data-kind={l.kind}
          data-line={l.key}
          data-muted={filter !== 'all' && filter !== l.kind}
          data-noted={l.noted}
          data-trace={litOf(lit, l.key)}
        >
          <path className={styles.reach} d={l.d} />
          <path className={styles.line} d={l.d} />
          <Head line={l} />
          <title>{l.tip}</title>
          <Hit
            h={BUTTON}
            inspect={l.inspect}
            label={l.label}
            w={BUTTON}
            x={l.into === 1 ? l.tx - HEAD - BUTTON : l.tx + HEAD}
            y={l.ty - BUTTON / 2}
          />
        </g>
      ))}
    </g>
  );
}
