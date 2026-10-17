import type { Model } from '@/application/plan/derive';
import { type JourneyComparison, journeyStep } from '@/application/plan/journey';
import {
  journeyMarkerText,
  type JourneyMode,
  rowTitle,
  stepIn,
} from '@/application/plan-viz-journey-words';
import type { StepNode } from '@/domain/plan/plan-graph';
import type { Op } from '@/domain/plan/plan.generated';

// Where a reader can go in a journey: the steps of the flow in order, the steps that are not in this view, and what to say of them.

export interface OutlineStep {
  readonly kind: 'step';
  readonly id: string;
  readonly n: number;
  readonly title: string;
  /** How the plan changes the step; empty when it runs as today. */
  readonly marker: string;
  readonly change: string;
}

export interface OutlineGap {
  readonly kind: 'gap';
  readonly label: string;
  readonly rows: readonly { readonly id: string; readonly title: string }[];
}

export type OutlineItem = OutlineStep | OutlineGap;

interface Gaps {
  /** The runs of absent steps that sit just before or after a step of this view. */
  readonly before: ReadonlyMap<string, OutlineGap>;
  readonly after: ReadonlyMap<string, OutlineGap>;
  /** Absent steps with no step of this view beside them. */
  readonly loose: readonly OutlineGap[];
}

const gapLabel = (mode: JourneyMode): string =>
  mode === 'asIs' ? 'Added here with this plan' : 'Removed from this part of the flow';

function gapsOf(model: Model, comparison: JourneyComparison, mode: JourneyMode): Gaps {
  const before = new Map<string, OutlineGap>();
  const after = new Map<string, OutlineGap>();
  const loose: { readonly id: string; readonly title: string }[] = [];
  const gapWith = (
    at: OutlineGap | undefined,
    row: { readonly id: string; readonly title: string },
  ): OutlineGap => ({ kind: 'gap', label: gapLabel(mode), rows: [...(at?.rows ?? []), row] });
  for (const row of comparison.rows) {
    if (stepIn(row, mode) !== null) continue;
    const { neighbours } = journeyStep(model, comparison.id, { stepId: row.id, mode });
    const item = { id: row.id, title: rowTitle(row, mode) };
    const { before: prev, after: next } = neighbours;
    if (prev !== null) after.set(prev, gapWith(after.get(prev), item));
    else if (next === null) loose.push(item);
    else before.set(next, gapWith(before.get(next), item));
  }
  const unanchored: OutlineGap[] =
    loose.length === 0 ? [] : [{ kind: 'gap', label: gapLabel(mode), rows: loose }];
  return { before, after, loose: unanchored };
}

/** The flow's steps in this view, with the steps it lacks shown where they would sit. */
export function outlineOf(
  model: Model,
  comparison: JourneyComparison,
  mode: JourneyMode,
): OutlineItem[] {
  const flow = mode === 'asIs' ? comparison.beforeFlow : comparison.afterFlow;
  const gaps = gapsOf(model, comparison, mode);
  const rows = new Map(comparison.rows.map((r) => [r.id, r]));
  const items: OutlineItem[] = [];
  for (const [i, step] of (flow?.steps ?? []).entries()) {
    const gap = (at: ReadonlyMap<string, OutlineGap>) => at.get(step.id);
    const row = rows.get(step.id);
    items.push(
      ...[gap(gaps.before)].filter((g) => g !== undefined),
      {
        kind: 'step',
        id: step.id,
        n: i + 1,
        title: step.action === '' ? step.id : step.action,
        marker: journeyMarkerText(row, mode),
        change: row?.kind ?? 'same',
      },
      ...[gap(gaps.after)].filter((g) => g !== undefined),
    );
  }
  return [...items, ...gaps.loose];
}

export interface AbsenceView {
  readonly stepId: string;
  readonly claim: string;
  /** What the step is called in the other view. */
  readonly title: string | null;
  readonly noNeighbours: boolean;
  readonly steps: readonly { readonly id: string; readonly label: string }[];
  /** The view that has what this one lacks, when there is one. */
  readonly counterpart: JourneyMode | null;
}

function claimOf(focus: ReturnType<typeof journeyStep>, mode: JourneyMode): string {
  if (!focus.flowExists) {
    if (focus.presence === 'added') return 'This flow does not exist today.';
    return focus.presence === 'removed'
      ? 'This flow is removed with this plan.'
      : 'This flow is not recorded.';
  }
  if (focus.row === null) return 'This step is not recorded in this flow.';
  return mode === 'asIs'
    ? 'This step is added with this plan.'
    : 'This step is removed with this plan.';
}

type Neighbours = ReturnType<typeof journeyStep>['neighbours'];

/** Where to go from an absent step: the surviving steps beside it, or the start of the flow. */
function stepsFrom(all: readonly StepNode[], neighbours: Neighbours, lone: boolean) {
  const named = (id: string | null, word: string) => {
    const step = all.find((s) => s.id === id);
    return step === undefined
      ? []
      : [{ id: step.id, label: `${word}: ${step.action === '' ? step.id : step.action}` }];
  };
  return [
    ...named(neighbours.before, 'Previous surviving step'),
    ...named(neighbours.after, 'Next surviving step'),
    ...(lone ? named(all[0]?.id ?? null, 'Open this flow from') : []),
  ];
}

/** What to say where the chosen step, or the whole flow, is not in this view. */
export function absenceOf(
  model: Model,
  flowId: string,
  focus: { readonly stepId: string; readonly mode: JourneyMode },
): AbsenceView {
  const { mode, stepId } = focus;
  const selection = journeyStep(model, flowId, focus);
  const { comparison, row, neighbours } = selection;
  const flow = mode === 'asIs' ? comparison.beforeFlow : comparison.afterFlow;
  const noNeighbours =
    selection.flowExists && row !== null && neighbours.before === null && neighbours.after === null;
  const other: JourneyMode = mode === 'asIs' ? 'toBe' : 'asIs';
  const counterpart = mode === 'asIs' ? comparison.afterFlow : comparison.beforeFlow;
  return {
    stepId,
    claim: claimOf(selection, mode),
    title: row === null ? null : rowTitle(row, other),
    noNeighbours,
    steps: stepsFrom(flow?.steps ?? [], neighbours, noNeighbours),
    counterpart: counterpart === null ? null : other,
  };
}

const endedId = (op: Op): string | undefined => {
  if ('remove' in op) return op.remove;
  return 'deprecate' in op ? op.deprecate : undefined;
};

/** What the plan says about rolling out the removal or deprecation of a flow or step. */
export function rolloutNotes(model: Model, flowId: string, stepId: string): string[] {
  const targets = new Set([flowId, stepId]);
  const notes = (model.plan.changes ?? [])
    .filter((c) => c.ops.some((op) => targets.has(endedId(op) ?? '')))
    .map((c) => c.rollout)
    .filter((n): n is string => n !== undefined && n !== '');
  return [...new Set(notes)];
}
