// Delivery, derived and never authored: once a work item has a GitHub issue, the plan is no longer only agreed,
// it is being built. The stage comes from `github_issue` on work items and the issue state in status.json;
// meta.status keeps the people's part (draft → review → approved).

import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { IssueStatus } from '@/domain/plan/plan-status';

/** The parts of a plan delivery reads; a whole Plan fits. */
export interface DeliveryPlan {
  readonly meta?: { readonly status?: string; readonly revisions?: readonly RevisionEntry[] };
  readonly work_items?: readonly { readonly id: string; readonly github_issue?: number }[];
}

export interface FiledWork {
  readonly issue: string;
  readonly state: 'open' | 'closed' | null;
}

export interface DeliveryState {
  /** meta.status (draft | review | approved; 'committed' reads as approved) until an issue is filed, then 'in-delivery', and 'delivered' once every work item has a closed issue. */
  readonly stage: string;
  readonly filed: number;
  readonly done: number;
  readonly total: number;
  readonly items: ReadonlyMap<string, FiledWork>;
  /** The proposal's new work items, left out of every count. */
  readonly pending: ReadonlySet<string>;
  /** The proposed version, when the head is one. */
  readonly proposed: string | null;
}

const proposedHead = (plan: DeliveryPlan | null | undefined): RevisionEntry | null => {
  const head = plan?.meta?.revisions?.at(-1);
  return head?.status === 'proposed' ? head : null;
};

/**
 * The work items only a live proposal has: in the head plan but not in the approved version teams build from.
 * With the approved snapshot, by id; without it, the proposer's word (`work: [{item, action: new}]`).
 * An empty set when the head is not a proposal.
 */
export function proposedOnlyWork(
  plan: DeliveryPlan,
  approvedPlan: DeliveryPlan | null = null,
): Set<string> {
  const head = proposedHead(plan);
  if (head === null) return new Set();
  const items = plan.work_items ?? [];
  if (approvedPlan !== null) {
    const base = new Set((approvedPlan.work_items ?? []).map((w) => w.id));
    return new Set(items.map((w) => w.id).filter((id) => !base.has(id)));
  }
  return new Set((head.work ?? []).filter((w) => w.action === 'new').map((w) => w.item));
}

function filedItems(work: NonNullable<DeliveryPlan['work_items']>, status: IssueStatus) {
  const items = new Map<string, FiledWork>();
  for (const w of work) {
    if (w.github_issue === undefined) continue;
    items.set(w.id, { issue: String(w.github_issue), state: status[w.id]?.state ?? null });
  }
  return items;
}

function stageOf(
  plan: DeliveryPlan,
  counts: { readonly filed: number; readonly done: number; readonly total: number },
): string {
  if (counts.filed === 0) {
    const own = plan.meta?.status ?? 'draft';
    return own === 'committed' ? 'approved' : own;
  }
  return counts.done === counts.total ? 'delivered' : 'in-delivery';
}

/**
 * Where a plan stands in delivery.
 * @param status status.json: issue state per work item
 * @param approvedPlan the approved snapshot while a proposal is the head: work items only the proposal has are
 *   left out of every count (teams build from the approved version) and listed in `pending`
 */
export function deliveryOf(
  plan: DeliveryPlan,
  status: IssueStatus = {},
  approvedPlan: DeliveryPlan | null = null,
): DeliveryState {
  const pending = proposedOnlyWork(plan, approvedPlan);
  const work = (plan.work_items ?? []).filter((w) => !pending.has(w.id));
  const items = filedItems(work, status);
  const done = [...items.values()].filter((x) => x.state === 'closed').length;
  const counts = { filed: items.size, done, total: work.length };
  return {
    stage: stageOf(plan, counts),
    ...counts,
    items,
    pending,
    proposed: proposedHead(plan)?.version ?? null,
  };
}

/** Is this work item only in the live proposal (not counted until it is approved)? */
export const isPending = (delivery: DeliveryState | null | undefined, id: string): boolean =>
  delivery?.pending.has(id) ?? false;

/** Badge text for a stage: "in delivery · 3 of 7 done", "delivered", or the plain status. */
export function stageText(d: DeliveryState | null | undefined): string {
  if (!d) return '';
  return d.stage === 'in-delivery'
    ? `in delivery · ${String(d.done)} of ${String(d.total)} done`
    : d.stage;
}

/**
 * Where a work item stands, from a delivery: 'done' | 'open' | 'not-started', or null before delivery starts
 * (no work item has a GitHub issue yet).
 */
export function workState(
  delivery: DeliveryState | null | undefined,
  id: string,
): 'done' | 'open' | 'not-started' | null {
  if (!delivery || delivery.items.size === 0) return null;
  const item = delivery.items.get(id);
  if (item === undefined) return 'not-started';
  return item.state === 'closed' ? 'done' : 'open';
}

/**
 * What a revision does to one work item, in the words every surface uses (a card's tag, the revision page's list):
 * [live proposal, approved, rejected, tag class]. The tag reads "<word> in 1.2".
 */
export const EFFECT = {
  rework: ['reopened', 'reworked', 'would have been reopened', 'dep'],
  changes: ['changes', 'changed', 'would have changed', 'mod'],
  check: ['check it still fits', 'checked', 'would have needed a check', 'data'],
  new: ['new', 'added', 'would have been added', 'add'],
  drop: ['dropped', 'dropped', 'would have been dropped', 'dep'],
  moves: ['moves milestone', 'moved milestone', 'would have moved milestone', 'mod'],
  renamed: ['title only', 'retitled', 'title only', 'quiet'],
  keep: ['no change', 'unchanged', 'no change', 'quiet'],
} as const;

/** "4 work items under way, 2 of them done": in the plan's words (work items), not GitHub's (issues). */
export function impactText(x: { readonly filed: number; readonly closed: number }): string {
  const head = `${String(x.filed)} work ${x.filed === 1 ? 'item' : 'items'} under way`;
  if (x.closed === 0) return head;
  if (x.closed < x.filed) return `${head}, ${String(x.closed)} of them done`;
  return `${head}, ${x.filed === 1 ? 'already done' : 'all done'}`;
}
