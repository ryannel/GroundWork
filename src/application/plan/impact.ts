// What a revision does to the system the plan builds. planDiff says which entries a revision edits; this says what
// that means: compare the planned system of the base revision with the planned system of the revision (each plan's
// ops applied), step by step and screen by screen, then follow the consequences to the work, the teams and the
// questions a reviewer should ask. Derived, never authored; where the proposer has said what happens to a work item
// (`work` on the ledger entry) that wins over the inference.

import type { DeliveryState } from '@/application/plan/delivery';
import { str } from '@/application/plan/derive-values';
import { prop } from '@/application/plan/ids';
import type { Check } from '@/application/plan/impact-check-types';
import { checksOf } from '@/application/plan/impact-checks';
import { type Edge, newEdges } from '@/application/plan/impact-edges';
import { type FieldDelta, fieldDeltas, type Shape, shapes } from '@/application/plan/impact-fields';
import { type Journey, type JourneyStep, journeys } from '@/application/plan/impact-journeys';
import { planned } from '@/application/plan/impact-planned';
import { type ScreenChange, screensOf } from '@/application/plan/impact-screens';
import { workOf, type WorkImpact } from '@/application/plan/impact-work';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Plan } from '@/domain/plan/plan.generated';

export type { Check } from '@/application/plan/impact-check-types';
export type { Edge } from '@/application/plan/impact-edges';
export type { FieldDelta, Shape } from '@/application/plan/impact-fields';
export type { Journey, JourneyStep } from '@/application/plan/impact-journeys';
export type { ScreenChange } from '@/application/plan/impact-screens';
export type { WorkImpact } from '@/application/plan/impact-work';

export interface TeamImpact {
  id: string;
  work: WorkImpact[];
  steps: JourneyStep[];
  screens: ScreenChange[];
}

export interface Tell {
  team: string;
  why: string;
  whys: string[];
}

export interface Tally {
  fieldsAdded: number;
  fieldsRemoved: number;
  fieldsChanged: number;
  breaking: number;
  migration: number;
  optional: number;
  behaviour: number;
  stepsAdded: number;
  stepsRemoved: number;
  carries: number;
  screens: number;
  edges: number;
  rework: number;
  newWork: number;
  changes: number;
  check: number;
}

export interface RevisionImpact {
  /** A name for any system id in either revision (the planned systems know what ops add). */
  nameOf: (id: string) => string | null;
  /** Who to tell before approval, and why. */
  tell: Tell[];
  byPlace: Map<string, string[]>;
  fields: FieldDelta[];
  shape: Shape;
  journeys: Journey[];
  screens: ScreenChange[];
  edges: Edge[];
  work: WorkImpact[];
  checks: Check[];
  teams: TeamImpact[];
  tally: Tally;
}

export interface ImpactInput {
  from: Plan;
  to: Plan;
  /** planDiff(from, to). */
  diff?: PlanDiff | null;
  delivery?: DeliveryState | null;
  /** The ledger entry; its `work` is the proposer's word on each work item. */
  entry?: RevisionEntry | null;
}

const MOVING = new Set(['rework', 'changes', 'drop', 'new']);

/** Every reason a team is told, loudest first (work is sorted by weight). Approval is the plan owner's merge. */
function whoToTell(work: WorkImpact[], edges: Edge[], by: ReadonlySet<string>): Tell[] {
  const tell = new Map<string, string[]>();
  const because = (team: string, why: string) => {
    if (by.has(team)) return;
    const whys = tell.get(team) ?? [];
    if (!whys.includes(why)) tell.set(team, [...whys, why]);
  };
  for (const x of work.filter((w) => MOVING.has(w.effect))) because(x.team, x.effect);
  for (const e of edges.filter((x) => x.crossTeam)) for (const t of e.teams) because(t, 'edge');
  return [...tell].flatMap(([team, whys]) =>
    whys[0] === undefined ? [] : [{ team, why: whys[0], whys }],
  );
}

const count = <T>(xs: T[], f: (x: T) => boolean): number => xs.filter(f).length;

function tallyOf({
  deltas,
  steps,
  screens,
  edges,
  work,
}: {
  deltas: FieldDelta[];
  steps: JourneyStep[];
  screens: ScreenChange[];
  edges: Edge[];
  work: WorkImpact[];
}): Tally {
  const real = deltas.filter((d) => !d.cosmetic);
  return {
    fieldsAdded: count(real, (d) => d.kind === 'added'),
    fieldsRemoved: count(real, (d) => d.kind === 'removed'),
    fieldsChanged: count(real, (d) => d.kind === 'edited'),
    breaking: count(deltas, (d) => d.verdict === 'breaking'),
    migration: count(deltas, (d) => d.verdict === 'migration'),
    optional: count(real, (d) => d.kind === 'added' && d.verdict === 'safe'),
    behaviour: count(steps, (s) => s.mark === 'behaviour'),
    stepsAdded: count(steps, (s) => s.mark === 'added'),
    stepsRemoved: count(steps, (s) => s.mark === 'removed'),
    carries: count(steps, (s) => s.mark === 'data'),
    screens: count(screens, (s) => s.mark !== 'data'),
    edges: count(edges, (e) => e.crossTeam),
    rework: count(work, (x) => x.effect === 'rework'),
    newWork: count(work, (x) => x.effect === 'new'),
    changes: count(work, (x) => x.effect === 'changes'),
    check: count(work, (x) => x.effect === 'check'),
  };
}

/**
 * What a revision does, from the base revision's plan to the revision's.
 */
export function revisionImpact({
  from,
  to,
  diff = null,
  delivery = null,
  entry = null,
}: ImpactInput): RevisionImpact {
  const [A, B] = [planned(from), planned(to)];
  const deltas = fieldDeltas(A, B);
  const sides = { A, B, shape: shapes(B, deltas) };
  const flows = journeys(sides);
  const screens = screensOf(sides);
  const edges = newEdges(A, B);
  const { work, byPlace } = workOf({
    sides,
    flows,
    screens,
    diff,
    delivery,
    authored: entry?.work,
  });
  const checks = checksOf({ sides, deltas, flows, screens, edges, work, diff, entry });
  const steps = flows.flatMap((f) => f.steps);
  const teams = to.teams.map((t) => ({
    id: t.id,
    work: work.filter((x) => x.team === t.id),
    steps: steps.filter((s) => s.mark !== null && s.team === t.id),
    screens: screens.filter((s) => s.team === t.id),
  }));
  return {
    nameOf: (id) => {
      for (const P of [B, A]) {
        const e = P.g.get(id);
        if (e === undefined) continue;
        const name = str(prop(e, 'name')) ?? str(prop(e, 'action'));
        if (name !== undefined && name !== '') return name;
      }
      return null;
    },
    tell: whoToTell(work, edges, new Set(entry?.by)),
    byPlace,
    fields: deltas,
    shape: sides.shape,
    journeys: flows.filter((f) => f.status !== null),
    screens,
    edges,
    work,
    checks,
    teams,
    tally: tallyOf({ deltas, steps, screens, edges, work }),
  };
}
