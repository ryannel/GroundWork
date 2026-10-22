import { useMemo, useState, useSyncExternalStore } from 'react';

import { drawSystemMap } from '@/application/plan-viz-system-map';
import { bySystem } from '@/application/plan-viz-system-map-columns';
import { infrastructureOf, withoutInfrastructure } from '@/application/plan-viz-system-map-infra';
import { type Trace, type TraceTarget, traceOf } from '@/application/plan-viz-system-map-trace';
import {
  type LineKind,
  type MapShow,
  SHOW_ALL,
  SHOW_OVERVIEW,
  type SystemMapDrawing,
  type SystemMapInput,
} from '@/application/plan-viz-system-map-types';
import { openId, serverOpenId, subscribe } from '@/features/plan/inspector-history';

export type LineFilter = 'all' | LineKind;
export type Layer = keyof MapShow;

// A map with more stages than this, or about more than one system, opens as an overview; the reader asks for
// the parts.
const WIDE = 5;

export interface SystemMapState {
  readonly show: MapShow;
  readonly filter: LineFilter;
  readonly drawing: SystemMapDrawing | null;
  readonly trace: Trace | null;
  /** How many components are infrastructure, and whether the map shows them. */
  readonly infra: { readonly count: number; readonly shown: boolean };
  readonly toggleInfra: () => void;
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

/** The card open in the inspector stays traced when the pointer leaves the map, so a click picks a system to read. */
function pinnedOf(drawing: SystemMapDrawing | null, open: string | null): TraceTarget | null {
  if (drawing === null || open === null) return null;
  return drawing.nodes.some((n) => n.id === open) ? { kind: 'node', id: open } : null;
}

/** What the reader has chosen to see, the map drawn for it, and what the pointer is tracing. */
export function useSystemMap(input: SystemMapInput, focus: LineFilter = 'all'): SystemMapState {
  const [show, setLayers] = useState<MapShow>(() =>
    new Set(Object.values(input.stageOf)).size > WIDE || bySystem(input) ? SHOW_OVERVIEW : SHOW_ALL,
  );
  const [filter, setFilter] = useState<LineFilter>(focus);
  const [flip, setFlip] = useState<ReadonlySet<string>>(new Set());
  const [target, setTarget] = useState<TraceTarget | null>(null);
  const [infraShown, setInfraShown] = useState(false);
  const count = useMemo(() => infrastructureOf(input).size, [input]);
  const drawing = useMemo(
    () => drawSystemMap(infraShown ? input : withoutInfrastructure(input), { show, flip }),
    [input, show, flip, infraShown],
  );
  const open = useSyncExternalStore(subscribe, openId, serverOpenId);
  const trace = useMemo(() => {
    const at = target ?? pinnedOf(drawing, open);
    return drawing === null || at === null ? null : traceOf(drawing, at);
  }, [drawing, target, open]);
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
    infra: { count, shown: infraShown },
    toggleInfra: () => {
      setInfraShown((now) => !now);
      setFlip(new Set());
      setTarget(null);
    },
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
