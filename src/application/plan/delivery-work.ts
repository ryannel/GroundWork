// What a revision does to work under way. The impact itself is injected (`ImpactOf`): this file reads it.

import type { DeliveryState } from '@/application/plan/delivery';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Revision } from '@/application/plan/revision-types';
import type { Plan } from '@/domain/plan/plan.generated';

export interface TouchedWork {
  id: string;
  why: string;
  change?: string;
}

export interface ImpactWork {
  id: string;
  effect: string;
  why: string[];
  note?: string | null;
  authored?: boolean;
}

/** What a revision does to the work: one entry per work item it moves. */
export interface ImpactView {
  work: ImpactWork[];
}

export interface ImpactInput {
  from: Plan;
  to: Plan;
  diff: PlanDiff;
  delivery: DeliveryState | null;
  entry: RevisionEntry | null;
}

export type ImpactOf = (input: ImpactInput) => ImpactView;

type Touched = Map<string, TouchedWork>;

const adder =
  (out: Touched) =>
  (id: string, why: string, change?: string): void => {
    if (!out.has(id)) out.set(id, change === undefined ? { id, why } : { id, why, change });
  };

/** The changes a diff edits: those with ops other than added ones, and those whose own fields changed or went. */
function editedChanges(diff: PlanDiff): Set<string> {
  const entities = diff.entities.changes;
  return new Set([
    ...diff.ops.filter((o) => o.status !== 'added').map((o) => o.change),
    ...(entities?.changed ?? []).map((c) => c.id),
    ...(entities?.removed ?? []),
  ]);
}

/**
 * The work a revision touches: work items it adds, changes, drops or re-milestones, and those building a change
 * whose ops or fields it edits. Each with why it is touched.
 * @param diff base → revision
 * @param basePlan the plan the revision was proposed on (who builds what)
 */
export function workTouched(diff: PlanDiff | null, basePlan: Plan | null): TouchedWork[] {
  if (!diff) return [];
  const out: Touched = new Map();
  const touch = adder(out);
  for (const c of diff.entities.work_items?.changed ?? [])
    touch(c.id, `its ${c.keys.join(', ')} changes`);
  for (const id of diff.workItems.added) touch(id, 'it is new');
  for (const id of diff.workItems.removed) touch(id, 'it is dropped');
  for (const r of diff.workItems.remilestoned) touch(r.id, 'it moves milestone');
  const edited = editedChanges(diff);
  for (const w of basePlan?.work_items ?? []) {
    const hit = w.implements.find((c) => edited.has(c));
    if (hit !== undefined) touch(w.id, 'it builds a change this version edits', hit);
  }
  return [...out.values()];
}

export type FiledTouched = TouchedWork & { issue: string; state: 'open' | 'closed' | null };

/** The work a revision touches that is already under way (has a GitHub issue), with the issue and its state. */
export function filedWorkTouched(
  diff: PlanDiff | null,
  basePlan: Plan | null,
  delivery: DeliveryState | null,
): FiledTouched[] {
  const items = delivery?.items;
  if (items === undefined || items.size === 0) return [];
  return workTouched(diff, basePlan).flatMap((t) => {
    const filed = items.get(t.id);
    return filed === undefined ? [] : [{ ...t, ...filed }];
  });
}

export type FiledChanged = FiledTouched & { effect: string };

/**
 * The work under way a revision changes, by its impact: reopened, changed or dropped, the proposer's word first.
 * Items only carrying new data, renamed or kept are not counted.
 */
export function filedWorkChanged(
  impact: ImpactView | null,
  delivery: DeliveryState | null,
): FiledChanged[] {
  const items = delivery?.items;
  if (!impact || items === undefined || items.size === 0) return [];
  return impact.work
    .filter((w) => ['rework', 'changes', 'drop'].includes(w.effect))
    .flatMap((w) => {
      const filed = items.get(w.id);
      if (filed === undefined) return [];
      const why = w.why.join('; ');
      return [{ id: w.id, why: why === '' ? (w.note ?? '') : why, effect: w.effect, ...filed }];
    });
}

const LIVE = new WeakMap<Revision, Map<string, ImpactView>>();

const memoKey = (revision: Revision, delivery: DeliveryState | null): string =>
  [revision.head.version, delivery?.filed, delivery?.done].map(String).join('|');

/** The live proposal's impact on this delivery, once per revision and delivery state; null without a proposal. */
function liveImpact(
  revision: Revision,
  delivery: DeliveryState | null,
  impactOf: ImpactOf,
): ImpactView | null {
  const from = revision.approved?.plan;
  if (revision.head.status !== 'proposed' || !revision.diff || !from) return null;
  const memo = LIVE.get(revision) ?? new Map<string, ImpactView>();
  LIVE.set(revision, memo);
  const key = memoKey(revision, delivery);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const entry = revision.ledger.find((r) => r.version === revision.head.version) ?? null;
  const impact = impactOf({ from, to: revision.head.plan, diff: revision.diff, delivery, entry });
  memo.set(key, impact);
  return impact;
}

export interface ProposalImpact {
  version: string | null;
  filed: number;
  closed: number;
  items: FiledChanged[];
}

/** What a live proposal does to work under way, when it changes filed work, else null. */
export function proposalImpact(
  revision: Revision,
  delivery: DeliveryState | null,
  impactOf: ImpactOf,
): ProposalImpact | null {
  const items = filedWorkChanged(liveImpact(revision, delivery, impactOf), delivery);
  if (items.length === 0) return null;
  return {
    version: revision.head.version,
    filed: items.length,
    closed: items.filter((t) => t.state === 'closed').length,
    items,
  };
}

export interface ProposedEffect {
  effect: string;
  authored: boolean;
  note: string | null;
}

/**
 * What a live proposal does to each work item it moves, for the effects a card tags (reopened, changes, new,
 * dropped), else null. Inferred from the changes the item implements unless the ledger entry's `work` says it
 * (`authored`).
 */
export function proposalWork(
  revision: Revision,
  delivery: DeliveryState | null,
  impactOf: ImpactOf,
): { version: string | null; byId: Map<string, ProposedEffect> } | null {
  const impact = liveImpact(revision, delivery, impactOf);
  if (!impact) return null;
  const byId = new Map(
    impact.work
      .filter((w) => ['rework', 'changes', 'new', 'drop'].includes(w.effect))
      .map((w): [string, ProposedEffect] => [
        w.id,
        { effect: w.effect, authored: w.authored ?? false, note: w.note ?? null },
      ]),
  );
  return byId.size === 0 ? null : { version: revision.head.version, byId };
}
