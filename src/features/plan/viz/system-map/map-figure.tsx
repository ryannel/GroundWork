import type { Trace, TraceTarget } from '@/application/plan-viz-system-map-trace';
import type { SystemMapDrawing } from '@/application/plan-viz-system-map-types';

import { MapBands, MapOutside } from './map-bands';
import { MapEdges } from './map-edges';
import styles from './map-figure.module.css';
import { MapNode } from './map-node';
import { MapTrunks } from './map-trunks';
import type { LineFilter } from './use-system-map';

export interface MapFigureProps {
  readonly drawing: SystemMapDrawing;
  readonly filter: LineFilter;
  readonly trace: Trace | null;
  readonly onTrace: (target: TraceTarget | null) => void;
  readonly onFold: (id: string) => void;
}

function targetOf(from: EventTarget): TraceTarget | null {
  if (!(from instanceof Element)) return null;
  const edge = from.closest<SVGElement>('[data-line]')?.dataset.line;
  if (edge !== undefined) return { kind: 'line', key: edge };
  const node = from.closest<SVGElement>('[data-node]')?.dataset.node;
  return node === undefined ? null : { kind: 'node', id: node };
}

const mutedBy = (kinds: readonly string[], filter: LineFilter): boolean =>
  filter !== 'all' && !kinds.includes(filter);

/** The map at its own size: stage bands, then systems, the lines over them, and the cards on top. */
export function MapFigure({ drawing, filter, trace, onTrace, onFold }: MapFigureProps) {
  const systems = drawing.nodes.filter((n) => n.kind === 'system');
  const rest = drawing.nodes.filter((n) => n.kind !== 'system');
  const card = (n: (typeof drawing.nodes)[number]) => (
    <MapNode
      key={n.id}
      lit={trace === null ? null : trace.nodes.has(n.id)}
      muted={mutedBy(n.kinds, filter)}
      node={n}
      onFold={onFold}
    />
  );
  return (
    <svg
      aria-label={`System map: ${String(drawing.services)} components, ${String(drawing.satellites)} topics and stores`}
      className={styles.svg}
      height={drawing.h}
      onBlur={() => {
        onTrace(null);
      }}
      onFocus={(e) => {
        onTrace(targetOf(e.target));
      }}
      onPointerLeave={() => {
        onTrace(null);
      }}
      onPointerOver={(e) => {
        onTrace(targetOf(e.target));
      }}
      role="group"
      viewBox={`0 0 ${String(drawing.w)} ${String(drawing.h)}`}
      width={drawing.w}
    >
      <MapBands bands={drawing.bands} h={drawing.h} />
      <MapOutside h={drawing.h} outside={drawing.outside} w={drawing.w} />
      <MapTrunks lit={trace?.trunks ?? null} trunks={drawing.trunks} />
      {systems.map(card)}
      <MapEdges filter={filter} lines={drawing.lines} lit={trace?.lines ?? null} />
      {rest.map(card)}
    </svg>
  );
}
