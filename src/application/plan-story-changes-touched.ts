import type { Model } from '@/application/plan/derive';
import { ladderIds } from '@/application/plan-viz-ladder-order';
import type { PlanNode } from '@/domain/plan/plan-graph';

// What the plan touches, grouped by the kind of thing that changes, and who is behind each change. Chapter 4 draws
// one screen per kind, so every kind that is empty has no screen.

/** A small plan has at most this many changes; its story folds into fewer screens. */
const SMALL_PLAN = 3;

const RETIRED = new Set(['deprecated', 'removed']);

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

export const topOf = (id: string | null | undefined): string => (id ?? '').split('#')[0] ?? '';

const retiredIn = (model: Model, id: string): boolean => RETIRED.has(model.status(id) ?? '');

/** As-is messages and endpoints this plan deprecates, removes or replaces: the contracts that version or retire. */
function contractIdsOf(model: Model): string[] {
  return [...model.asIs.messages, ...model.asIs.endpoints]
    .map((x) => x.id)
    .filter((id) => retiredIn(model, id) || model.versions(id).replacedBy !== null);
}

export interface Touched {
  /** Record schemas that change. */
  readonly records: string[];
  readonly flows: string[];
  /** Contracts and graph fields that climb a migration ladder. */
  readonly ladders: string[];
  /** Other things that retire: payload schemas, stores, services, endpoints without a ladder. */
  readonly retired: string[];
  /** Non-record schemas (request and event bodies) whose fields change. */
  readonly shapes: string[];
  /** Screens whose picture, regions or route change, and screens the plan removes. */
  readonly screens: string[];
}

export function touched(model: Model): Touched {
  const ids = model.touchedAsIs();
  const node = (id: string): PlanNode | undefined => model.asIs.get(id);
  const schema = (id: string) => {
    const n = node(id);
    return n?.$type === 'schema' ? n : undefined;
  };
  const ladders = ladderIds(model);
  const inChains = new Set(ladders.flatMap((id) => model.ladder(id).chain));
  const retired = [
    ...ids.filter((id) => retiredIn(model, id) && !inChains.has(id) && node(id)?.$type !== 'flow'),
    ...contractIdsOf(model).filter((id) => !inChains.has(id) && !ids.includes(id)),
  ];
  return {
    records: ids.filter((id) => schema(id)?.kind === 'record' && !retiredIn(model, id)),
    flows: ids.filter((id) => node(id)?.$type === 'flow'),
    ladders,
    retired: uniq(retired),
    shapes: ids.filter((id) => {
      const s = schema(id);
      return s !== undefined && s.kind !== 'record' && !retiredIn(model, id);
    }),
    screens: ids.filter((id) => node(id)?.$type === 'screen' && model.screenDiff(id).changed),
  };
}

/** Changes behind an entity and its children, in the order the plan lists them. */
export function changesOf(model: Model, id: string): string[] {
  const direct = model.inverse(id).changes;
  const fromDiff = model.diff(id).flatMap((d) => (d.changeId === undefined ? [] : [d.changeId]));
  const order = (model.plan.changes ?? []).map((c) => c.id);
  return uniq([...fromDiff, ...direct]).toSorted((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** The teams behind these changes, in first-seen order. */
export const teamsBehind = (model: Model, changeIds: readonly string[]): string[] =>
  uniq(changeIds.flatMap((c) => model.teamsOf(c)));

/** A small plan has no graph change: one screen per flow, everything the flow reaches inline. */
export const isSmallPlan = (model: Model): boolean =>
  (model.plan.changes ?? []).length <= SMALL_PLAN;

export interface Reach {
  readonly records: string[];
  readonly screens: string[];
  readonly ladders: string[];
  readonly retired: string[];
  readonly shapes: string[];
}

export const isEmptyReach = (r: Reach): boolean => reachIds(r).length === 0;

export const reachIds = (r: Reach): string[] => [
  ...r.records,
  ...r.screens,
  ...r.ladders,
  ...r.retired,
  ...r.shapes,
];

/** The steps of a flow, as-is and to-be, each as the node that is still in the plan. */
function stepsOfFlow(
  model: Model,
  flowId: string,
): { id: string; touches: string[]; screen: string }[] {
  const flow = (g: Model['asIs']) => {
    const n = g.get(flowId);
    return n?.$type === 'flow' ? n.steps : [];
  };
  const all = [...flow(model.asIs), ...flow(model.toBe)];
  const seen = new Set<string>();
  const out: { id: string; touches: string[]; screen: string }[] = [];
  for (const step of all) {
    if (seen.has(step.id)) continue;
    seen.add(step.id);
    const latest = model.toBe.get(step.id) ?? step;
    const s = latest.$type === 'step' ? latest : step;
    out.push({
      id: s.id,
      touches: [...(s.reads ?? []), ...(s.writes ?? []), s.via],
      screen: topOf(s.screen),
    });
  }
  return out;
}

/**
 * What a flow reaches that also changes, read from its steps: the records its changed steps read or write, the
 * screens any of its steps shows, and the contracts any of its steps goes through or reads. A thing reached by two
 * flows belongs to the first.
 */
export function reachOf(
  model: Model,
  t: Touched,
  flow: { readonly id: string; readonly changed: ReadonlySet<string>; readonly taken: Set<string> },
): Reach {
  const { taken } = flow;
  const steps = stepsOfFlow(model, flow.id);
  const written = new Set(
    steps.filter((s) => flow.changed.has(s.id)).flatMap((s) => s.touches.map(topOf)),
  );
  const all = new Set(steps.flatMap((s) => s.touches.flatMap((x) => [x, topOf(x)])));
  const fresh = (ids: readonly string[]) => ids.filter((id) => !taken.has(id));
  const reach: Reach = {
    records: fresh(t.records.filter((id) => written.has(id))),
    screens: fresh(t.screens.filter((id) => steps.some((s) => s.screen === id))),
    ladders: fresh(t.ladders.filter((id) => model.ladder(id).chain.some((x) => all.has(x)))),
    retired: fresh(t.retired.filter((id) => all.has(id))),
    shapes: fresh(t.shapes.filter((id) => all.has(id))),
  };
  for (const id of reachIds(reach)) taken.add(id);
  return reach;
}

/** What no flow reaches. */
export function leftOver(t: Touched, taken: ReadonlySet<string>): Reach {
  const left = (ids: readonly string[]) => ids.filter((id) => !taken.has(id));
  return {
    records: left(t.records),
    screens: left(t.screens),
    ladders: left(t.ladders),
    retired: left(t.retired),
    shapes: left(t.shapes),
  };
}
