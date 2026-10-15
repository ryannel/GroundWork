import { useMemo, useState } from 'react';

import { drawSystemMap } from '@/application/plan-viz-system-map';
import { type Trace, type TraceTarget, traceOf } from '@/application/plan-viz-system-map-trace';
import {
  type LineKind,
  type MapShow,
  SHOW_ALL,
  SHOW_OVERVIEW,
  type SystemMapDrawing,
  type SystemMapInput,
} from '@/application/plan-viz-system-map-types';

export type LineFilter = 'all' | LineKind;
export type Layer = keyof MapShow;

// A map with more stages than this opens as an overview; the reader asks for the parts.
const WIDE = 5;

export interface SystemMapState {
  readonly show: MapShow;
  readonly filter: LineFilter;
  readonly drawing: SystemMapDrawing | null;
  readonly trace: Trace | null;
  readonly setFilter: (filter: LineFilter) => void;
  readonly setTarget: (target: TraceTarget | null) => void;
  readonly setShow: (show: MapShow) => void;
  readonly toggleLayer: (layer: Layer) => void;
  readonly fold: (id: string) => void;
}

function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** What the reader has chosen to see, the map drawn for it, and what the pointer is tracing. */
export function useSystemMap(input: SystemMapInput, focus: LineFilter = 'all'): SystemMapState {
  const [show, setLayers] = useState<MapShow>(() =>
    new Set(Object.values(input.stageOf)).size > WIDE ? SHOW_OVERVIEW : SHOW_ALL,
  );
  const [filter, setFilter] = useState<LineFilter>(focus);
  const [flip, setFlip] = useState<ReadonlySet<string>>(new Set());
  const [target, setTarget] = useState<TraceTarget | null>(null);
  const drawing = useMemo(() => drawSystemMap(input, { show, flip }), [input, show, flip]);
  const trace = useMemo(
    () => (drawing === null || target === null ? null : traceOf(drawing, target)),
    [drawing, target],
  );
  const setShow = (next: MapShow): void => {
    setLayers(next);
    setFlip(new Set());
    setTarget(null);
  };
  return {
    show,
    filter,
    drawing,
    trace,
    setFilter,
    setTarget,
    setShow,
    toggleLayer: (layer) => {
      setShow({ ...show, [layer]: !show[layer] });
    },
    fold: (id) => {
      setFlip((now) => toggled(now, id));
      setTarget(null);
    },
  };
}
