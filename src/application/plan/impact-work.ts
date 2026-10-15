import { type DeliveryState, workState } from '@/application/plan/delivery';
import type { Sides } from '@/application/plan/impact-fields';
import type { Carry, Journey, JourneyStep } from '@/application/plan/impact-journeys';
import type { ScreenChange } from '@/application/plan/impact-screens';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { WorkItem } from '@/domain/plan/plan.generated';

export type WorkEffect =
  'rework' | 'drop' | 'changes' | 'new' | 'moves' | 'check' | 'renamed' | 'keep';

const WEIGHT: Record<WorkEffect, number> = {
  rework: 6,
  drop: 5,
  changes: 4,
  new: 3,
  moves: 2,
  check: 1,
  renamed: 0,
  keep: -1,
};

/** What a revision does to one work item, and why. */
export interface WorkImpact {
  id: string;
  title: string;
  team: string;
  size: string | null;
  milestone: string | null;
  state: 'done' | 'open' | 'not-started' | null;
  effect: WorkEffect;
  why: string[];
  /** The ledger entry says so (else it is inferred). */
  authored: boolean;
  note: string | null;
  inferred: boolean;
  /** The revision drops the item from the plan. */
  gone: boolean;
}

export interface WorkInput {
  sides: Sides;
  flows: Journey[];
  screens: ScreenChange[];
  diff: PlanDiff | null;
  delivery: DeliveryState | null;
  authored: NonNullable<RevisionEntry['work']> | undefined;
}

export interface Worked {
  work: WorkImpact[];
  /** Step or screen id → the work items that build it. */
  byPlace: Map<string, string[]>;
}

interface Hit {
  effect: WorkEffect;
  why: { effect: WorkEffect; why: string }[];
}

type Told = NonNullable<WorkInput['authored']>[number];

interface Tally {
  sides: Sides;
  items: Map<string, WorkItem>;
  hits: Map<string, Hit>;
  byPlace: Map<string, string[]>;
  delivery: DeliveryState | null;
  told: Map<string, Told>;
  inB: Set<string>;
}

type Reason = [effect: WorkEffect, why: string];

const hit = (t: Tally, id: string, [effect, why]: Reason): void => {
  if (!t.items.has(id)) return;
  const cur = t.hits.get(id) ?? { effect, why: [] };
  if (!cur.why.some((w) => w.why === why)) cur.why.push({ effect, why });
  if (WEIGHT[effect] > WEIGHT[cur.effect]) cur.effect = effect;
  t.hits.set(id, cur);
};

const at = (t: Tally, place: string, id: string): void => {
  const ids = t.byPlace.get(place) ?? [];
  if (!ids.includes(id)) t.byPlace.set(place, [...ids, id]);
};

/** Done work is reopened by a change; the rest just changes. */
const behave = (t: Tally, id: string): WorkEffect =>
  workState(t.delivery, id) === 'done' ? 'rework' : 'changes';

/** Passing on an optional field is no work; a breaking one is. */
const breaks = (carries: Carry[]): boolean =>
  carries.some((c) => c.fields.some((f) => f.verdict !== 'safe'));

function edited(t: Tally, c: { id: string; keys: string[] }): void {
  const real = c.keys.filter((k) => k !== 'title' && k !== 'body');
  if (real.length === 0) hit(t, c.id, ['renamed', 'its title changes']);
  else hit(t, c.id, [behave(t, c.id), `its ${real.join(', ').replaceAll('_', ' ')} changes`]);
}

function fromDiff(t: Tally, diff: PlanDiff | null): void {
  if (diff === null) return;
  for (const id of diff.workItems.added) hit(t, id, ['new', 'it is new']);
  for (const id of diff.workItems.removed) hit(t, id, ['drop', 'it is dropped']);
  for (const r of diff.workItems.remilestoned) hit(t, r.id, ['moves', 'it moves milestone']);
  for (const c of diff.entities.work_items?.changed ?? []) edited(t, c);
}

/** A team's work items that implement one of these changes. */
const implementing = (t: Tally, team: string, changes: ReadonlySet<string>): WorkItem[] =>
  [...t.items.values()].filter((x) => x.team === team && x.implements.some((c) => changes.has(c)));

/** A team's work items that implement a change touching these ids. */
function builders(t: Tally, team: string, ids: string[]): WorkItem[] {
  const { A, B } = t.sides;
  const chg = new Set(ids.flatMap((id) => [...(B.changesOf.get(id) ?? A.changesOf.get(id) ?? [])]));
  return implementing(t, team, chg);
}

const STEP_WORDS = new Map([
  ['added', 'is a new step'],
  ['removed', 'is dropped'],
]);

function stepReason(s: JourneyStep): Reason | null {
  const label = s.step.action;
  if (s.mark === 'data') {
    return breaks(s.carries) ? ['check', `“${label}” carries data whose shape changes`] : null;
  }
  const what = STEP_WORDS.get(s.mark ?? '') ?? 'behaves differently';
  return ['changes', `“${label}” ${what}`];
}

/** A step or screen's team builds it through a work item implementing a change that touches it (else the flow's). */
function stepWork(t: Tally, flowChanges: ReadonlySet<string>, s: JourneyStep): void {
  const reason = stepReason(s);
  if (s.mark === null || s.team === null || reason === null) return;
  const direct = builders(t, s.team, [s.id]);
  for (const x of direct.length > 0 ? direct : implementing(t, s.team, flowChanges)) {
    at(t, s.id, x.id);
    hit(t, x.id, reason[0] === 'check' ? reason : [behave(t, x.id), reason[1]]);
  }
}

function fromSteps(t: Tally, flows: Journey[]): void {
  for (const f of flows) {
    const flowChanges = new Set(f.steps.flatMap((s) => [...(t.sides.B.changesOf.get(s.id) ?? [])]));
    for (const s of f.steps) stepWork(t, flowChanges, s);
  }
}

function screenWork(t: Tally, sc: ScreenChange): void {
  if (sc.team === null) return;
  if (sc.mark === 'data' && !breaks(sc.regions.flatMap((r) => r.carries))) return;
  const name = sc.screen.name;
  for (const x of builders(t, sc.team, [sc.id, ...sc.regions.map((r) => r.id)])) {
    at(t, sc.id, x.id);
    if (sc.mark === 'data')
      hit(t, x.id, ['check', `the screen “${name}” shows data whose shape changes`]);
    else hit(t, x.id, [behave(t, x.id), `the screen “${name}” changes`]);
  }
}

/** The marked steps and screens a team acts in. */
const placesOf = (team: string, { flows, screens }: WorkInput): string[] => [
  ...flows.flatMap((f) =>
    f.steps.filter((s) => s.mark !== null && s.team === team).map((s) => s.id),
  ),
  ...screens.filter((sc) => sc.team === team).map((sc) => sc.id),
];

/** The proposer's rework sits on the marked steps and screens its team acts in, so the journey shows who builds it. */
function placeAuthored(t: Tally, input: WorkInput): void {
  for (const [id, said] of t.told) {
    const wi = t.items.get(id);
    if (wi === undefined || said.action === 'keep') continue;
    for (const place of placesOf(wi.team, input)) at(t, place, id);
  }
}

const sameEffect = (a: WorkEffect, b: WorkEffect): boolean =>
  a === b || (a === 'rework' && b === 'changes') || (a === 'changes' && b === 'rework');

function effectOf(t: Tally, id: string, said: Told | undefined): WorkEffect | undefined {
  if (said === undefined) return t.hits.get(id)?.effect;
  const authored: Record<Told['action'], WorkEffect> = {
    rework: behave(t, id),
    keep: 'keep',
    drop: 'drop',
    new: 'new',
  };
  return authored[said.action];
}

function impactOf(t: Tally, id: string): WorkImpact | null {
  const [wi, said] = [t.items.get(id), t.told.get(id)];
  const effect = effectOf(t, id, said);
  if (wi === undefined || effect === undefined) return null;
  // the reasons for what happens to it, not every way it is touched
  const why = (t.hits.get(id)?.why ?? [])
    .filter((w) => sameEffect(w.effect, effect))
    .map((w) => w.why);
  return {
    id,
    title: wi.title,
    team: wi.team,
    size: wi.size ?? null,
    milestone: wi.milestone ?? null,
    state: workState(t.delivery, id),
    effect,
    why,
    authored: said !== undefined,
    note: said?.note ?? null,
    inferred: said === undefined,
    gone: !t.inB.has(id),
  };
}

/**
 * The work a revision touches, each with what it means for it and why: authored (the ledger entry's `work`), else
 * from the diff (added, dropped, re-milestoned, edited) and the journey (a team's work item that builds a step that
 * behaves differently, or carries data whose shape changes).
 */
export function workOf(input: WorkInput): Worked {
  const { A, B } = input.sides;
  const items = new Map<string, WorkItem>();
  for (const w of [...(A.plan.work_items ?? []), ...(B.plan.work_items ?? [])]) {
    if (!items.has(w.id)) items.set(w.id, w);
  }
  const t: Tally = {
    sides: input.sides,
    items,
    hits: new Map(),
    byPlace: new Map(),
    delivery: input.delivery,
    told: new Map((input.authored ?? []).map((x) => [x.item, x])),
    inB: new Set((B.plan.work_items ?? []).map((w) => w.id)),
  };
  fromDiff(t, input.diff);
  fromSteps(t, input.flows);
  for (const sc of input.screens) screenWork(t, sc);
  placeAuthored(t, input);
  const work = [...items.keys()]
    .flatMap((id) => impactOf(t, id) ?? [])
    .toSorted((a, b) => WEIGHT[b.effect] - WEIGHT[a.effect]);
  return { work, byPlace: t.byPlace };
}
