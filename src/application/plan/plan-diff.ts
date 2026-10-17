// Semantic diff between two revisions of a plan (by id, not by line), for the weekly update.
// Pure: takes two parsed plans, returns a structure; plan-diff-markdown.ts renders it.

import { derive } from '@/application/plan/derive';
import { type Rec, prop } from '@/application/plan/ids';
import {
  type Collections,
  type EntityDiff,
  type MovedMilestone,
  type PlanDiff,
  type PlanMeta,
  collections,
  differing,
  none,
  text,
  textOr,
} from '@/application/plan/plan-diff-core';
import { type Derived, opsDiff, summariser } from '@/application/plan/plan-diff-ops';
import type { Plan } from '@/domain/plan/plan.generated';

/** Keys of an entity that changed; a change's ops are reported separately, and github_issue is bookkeeping from the issue export. */
function changedKeys(collection: string, ea: Rec, eb: Rec): string[] {
  return differing(ea, eb)
    .filter((k) => !(collection === 'changes' && k === 'ops'))
    .filter((k) => !(collection === 'work_items' && k === 'github_issue'));
}

function entitiesDiff(a: Collections, b: Collections): Record<string, EntityDiff> {
  const out: Record<string, EntityDiff> = {};
  for (const [key, B] of Object.entries(b)) {
    const A = a[key] ?? none();
    const changed = [...B]
      .filter(([id]) => A.has(id))
      .map(([id, eb]) => ({ id, keys: changedKeys(key, A.get(id) ?? eb, eb) }))
      .filter((c) => c.keys.length > 0);
    const added = [...B.keys()].filter((id) => !A.has(id));
    const removed = [...A.keys()].filter((id) => !B.has(id));
    if (added.length + removed.length + changed.length > 0) out[key] = { added, removed, changed };
  }
  return out;
}

function questionsDiff(a: Collections, b: Collections): PlanDiff['questions'] {
  const rows = [...(b.questions ?? none())].map(([id, q]) => ({
    id,
    prev: a.questions?.get(id),
    open: q.status !== 'resolved',
  }));
  const ids = (keep: (r: (typeof rows)[number]) => boolean): string[] =>
    rows.filter(keep).map((r) => r.id);
  return {
    opened: ids((r) => r.prev === undefined && r.open),
    resolved: ids((r) => !r.open && r.prev?.status !== 'resolved'),
    reopened: ids((r) => r.open && r.prev?.status === 'resolved'),
  };
}

function workItemsDiff(a: Collections, b: Collections): PlanDiff['workItems'] {
  const [WA, WB] = [a.work_items ?? none(), b.work_items ?? none()];
  const remilestoned = [...WB]
    .filter(([id]) => WA.has(id))
    .map(([id, w]) => ({ id, from: text(WA.get(id)?.milestone), to: text(w.milestone) }))
    .filter((r) => r.from !== r.to);
  return {
    added: [...WB.keys()].filter((id) => !WA.has(id)),
    removed: [...WA.keys()].filter((id) => !WB.has(id)),
    remilestoned,
  };
}

/** Milestones whose due date or position changed. */
function milestonesMoved(a: Collections, b: Collections): MovedMilestone[] {
  const before = [...(a.milestones ?? none()).values()];
  const moved: MovedMilestone[] = [];
  for (const [toIndex, m] of [...(b.milestones ?? none()).values()].entries()) {
    const fromIndex = before.findIndex((x) => x.id === m.id);
    const prev = before[fromIndex];
    if (prev === undefined) continue;
    if (text(prev.due) !== text(m.due) || fromIndex !== toIndex) {
      const id = textOr(m.id, '');
      const [fromDue, toDue] = [text(prev.due), text(m.due)];
      moved.push({ id, name: textOr(m.name, id), fromDue, toDue, fromIndex, toIndex });
    }
  }
  return moved;
}

const metaOf = (p: unknown): PlanMeta => {
  const meta = prop(p, 'meta');
  return {
    version: text(prop(meta, 'version')),
    date: text(prop(meta, 'date')),
    status: text(prop(meta, 'status')),
  };
};

const noWorkOrMilestones = ({ workItems: w, milestones }: Omit<PlanDiff, 'empty'>): boolean =>
  w.added.length + w.removed.length + w.remilestoned.length + milestones.moved.length === 0;

const isEmpty = (d: Omit<PlanDiff, 'empty'>): boolean =>
  Object.keys(d.entities).length === 0 &&
  d.ops.length === 0 &&
  Object.values(d.questions).every((x) => x.length === 0) &&
  noWorkOrMilestones(d);

function safeDerive(plan: Plan): Derived | null {
  try {
    return derive(plan);
  } catch {
    return null;
  }
}

/** Semantic diff of two parsed plans: what the new one adds, removes and changes against the old. */
export function planDiff(oldPlan: Plan, newPlan: Plan): PlanDiff {
  const [a, b] = [collections(oldPlan), collections(newPlan)];
  const sum = { from: summariser(safeDerive(oldPlan)), to: summariser(safeDerive(newPlan)) };
  const diff = {
    from: metaOf(oldPlan),
    to: metaOf(newPlan),
    title: textOr(newPlan.meta.title, textOr(oldPlan.meta.title, 'plan')),
    entities: entitiesDiff(a, b),
    ops: opsDiff(a, b, sum),
    questions: questionsDiff(a, b),
    workItems: workItemsDiff(a, b),
    milestones: { moved: milestonesMoved(a, b) },
  };
  return { ...diff, empty: isEmpty(diff) };
}
