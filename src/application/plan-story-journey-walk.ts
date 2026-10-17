import type { Model } from '@/application/plan/derive';
import { journeyComparison } from '@/application/plan/journey';
import { type JourneyMode, rowTitle } from '@/application/plan-viz-journey-words';

// A scenario is walked as one line: every step of every flow it runs, in the scenario's order. The line is the
// same in both views so a place survives a switch; a view walks only the steps it has, and a flow it lacks is
// visited once, at its start, so the reader still learns it is missing.

export interface Position {
  readonly flowId: string;
  /** Null for a flow with no recorded steps. */
  readonly stepId: string | null;
}

export interface Walk {
  readonly positions: readonly Position[];
  /** The positions each view stops at, as indexes into `positions`. */
  readonly stops: Readonly<Record<JourneyMode, readonly number[]>>;
  /** What each position is called, in each view. */
  readonly titles: Readonly<Record<JourneyMode, readonly string[]>>;
  /** The flows' names, by id. */
  readonly flows: Readonly<Record<string, string>>;
  /** The flows each view lacks. */
  readonly missing: Readonly<Record<JourneyMode, readonly string[]>>;
}

function stopsIn(
  model: Model,
  positions: readonly Position[],
  mode: JourneyMode,
): readonly number[] {
  const graph = mode === 'asIs' ? model.asIs : model.toBe;
  const seen = new Set<string>();
  return positions.flatMap((p, i) => {
    const first = !seen.has(p.flowId);
    seen.add(p.flowId);
    const here = p.stepId === null ? graph.has(p.flowId) : graph.has(p.stepId);
    return here || (first && !graph.has(p.flowId)) ? [i] : [];
  });
}

/** The line a scenario's flows make, and where each view stops on it. */
export function walkOf(model: Model, flowIds: readonly string[]): Walk {
  const positions: Position[] = [];
  const titles: Record<JourneyMode, string[]> = { asIs: [], toBe: [] };
  for (const flowId of flowIds) {
    const { rows } = journeyComparison(model, flowId);
    if (rows.length === 0) {
      positions.push({ flowId, stepId: null });
      titles.asIs.push(model.label(flowId));
      titles.toBe.push(model.label(flowId));
    }
    for (const row of rows) {
      positions.push({ flowId, stepId: row.id });
      titles.asIs.push(rowTitle(row, 'asIs'));
      titles.toBe.push(rowTitle(row, 'toBe'));
    }
  }
  return {
    positions,
    stops: { asIs: stopsIn(model, positions, 'asIs'), toBe: stopsIn(model, positions, 'toBe') },
    titles,
    flows: Object.fromEntries(flowIds.map((id) => [id, model.label(id)])),
    missing: {
      asIs: flowIds.filter((id) => !model.asIs.has(id)),
      toBe: flowIds.filter((id) => !model.toBe.has(id)),
    },
  };
}

/** The stop after (1) or before (-1) the position in the view, or null at the end of the line. */
export function stopBeside(
  walk: Walk,
  at: { readonly index: number; readonly mode: JourneyMode },
  by: -1 | 1,
): number | null {
  const stops = walk.stops[at.mode];
  const found = by === 1 ? stops.find((i) => i > at.index) : stops.findLast((i) => i < at.index);
  return found ?? null;
}

/** Where a reader arriving from the next screen (-1) or the previous one (1) begins. */
export function entryOf(walk: Walk, mode: JourneyMode, from: -1 | 1): number {
  const stops = walk.stops[mode];
  return (from === -1 ? stops.at(-1) : stops[0]) ?? 0;
}

/** The position a step or flow id names, or -1. */
export function positionOf(walk: Walk, id: string): number {
  const step = walk.positions.findIndex((p) => p.stepId === id);
  return step === -1 ? walk.positions.findIndex((p) => p.flowId === id) : step;
}

/** "Step 3 of 12 in this scenario", counting only the recorded steps the view has. */
export function progressOf(
  walk: Walk,
  at: { readonly index: number; readonly mode: JourneyMode },
  whole = 'scenario',
): string {
  const missing = new Set(walk.missing[at.mode]);
  const counts = (i: number): boolean => {
    const p = walk.positions[i];
    return (p?.stepId ?? null) !== null && !missing.has(p?.flowId ?? '');
  };
  const steps = walk.stops[at.mode].filter(counts);
  const n = steps.indexOf(at.index);
  if (walk.positions[at.index]?.stepId === null) return 'No recorded steps';
  if (n === -1) return 'Not in this view';
  const where = Object.keys(walk.flows).length > 1 ? ` in this ${whole}` : '';
  return `Step ${String(n + 1)} of ${String(steps.length)}${where}`;
}
