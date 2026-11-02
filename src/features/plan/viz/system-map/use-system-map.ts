import { useMemo, useState, useSyncExternalStore } from 'react';

import { drawSystemMap } from '@/application/plan-viz-system-map';
import { bySystem } from '@/application/plan-viz-system-map-columns';
import { infrastructureOf, withoutInfrastructure } from '@/application/plan-viz-system-map-infra';
import { structureMapInput } from '@/application/plan-viz-system-map-structure';
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
export type MapView = 'flow' | 'structure';

interface DetailState {
  readonly show: MapShow;
  readonly flip: ReadonlySet<string>;
}

// Large maps open as an overview; components and their interfaces remain one click away.
const WIDE = 5;
const DETAILED_COMPONENTS = 12;

export interface SystemMapState {
  readonly show: MapShow;
  readonly view: MapView;
  readonly hasValueFlow: boolean;
  readonly setView: (view: MapView) => void;
  readonly filter: LineFilter;
  readonly drawing: SystemMapDrawing | null;
  readonly trace: Trace | null;
  /** How many components are infrastructure, and whether the map shows them. */
  readonly infra: { readonly count: number; readonly shown: boolean };
  readonly toggleInfra: () => void;
  readonly setFilter: (filter: LineFilter) => void;
  readonly setTarget: (target: TraceTarget | null) => void;
  readonly setShow: (show: MapShow) => void;
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
  const hasValueFlow = input.stages.length > 0;
  const [chosenView, setChosenView] = useState<MapView>(hasValueFlow ? 'flow' : 'structure');
  const view = hasValueFlow ? chosenView : 'structure';
  const [details, setDetails] = useState<Readonly<Record<MapView, DetailState>>>(() => {
    const initial =
      new Set(Object.values(input.stageOf)).size > WIDE ||
      input.services.length > DETAILED_COMPONENTS ||
      bySystem(input)
        ? SHOW_OVERVIEW
        : SHOW_ALL;
    return {
      flow: { show: initial, flip: new Set() },
      structure: { show: hasValueFlow ? SHOW_OVERVIEW : initial, flip: new Set() },
    };
  });
  const { show, flip } = details[view];
  const [lines, setLines] = useState({ focus, filter: focus });
  if (lines.focus !== focus) setLines({ focus, filter: focus });
  const filter = lines.filter;
  const [target, setTarget] = useState<TraceTarget | null>(null);
  const [infraShown, setInfraShown] = useState(false);
  const count = useMemo(() => infrastructureOf(input).size, [input]);
  const drawing = useMemo(() => {
    const visible = infraShown ? input : withoutInfrastructure(input);
    const arranged = view === 'structure' && hasValueFlow ? structureMapInput(visible) : visible;
    return drawSystemMap(arranged, { show, flip });
  }, [input, show, flip, infraShown, view, hasValueFlow]);
  const open = useSyncExternalStore(subscribe, openId, serverOpenId);
  const trace = useMemo(() => {
    const at = target ?? pinnedOf(drawing, open);
    return drawing === null || at === null ? null : traceOf(drawing, at);
  }, [drawing, target, open]);
  const setShow = (next: MapShow): void => {
    setDetails((current) => ({ ...current, [view]: { show: next, flip: new Set() } }));
    setTarget(null);
  };
  return {
    show,
    view,
    hasValueFlow,
    setView: (next) => {
      setChosenView(next);
      setTarget(null);
    },
    filter,
    drawing,
    trace,
    infra: { count, shown: infraShown },
    toggleInfra: () => {
      setInfraShown((now) => !now);
      setShow(show);
      setTarget(null);
    },
    setFilter: (next) => {
      setLines({ focus, filter: next });
    },
    setTarget,
    setShow,
    fold: (id) => {
      setDetails((current) => ({
        ...current,
        [view]: { ...current[view], flip: toggled(current[view].flip, id) },
      }));
      setTarget(null);
    },
  };
}
