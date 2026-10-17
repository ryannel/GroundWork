// Plans with a revision ledger and the snapshots of earlier versions, as the versions chapter reads them: what
// planRevision builds from plans/<plan>/revisions/<version>.yaml, worked out from typed plans instead of the disk.
import { giftWrapOverlay } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { orderEventV2Overlay } from '@/../test/fixtures/acme/plans/versions-order-event';
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import { deliveryOf } from '@/application/plan/delivery';
import { buildRevision } from '@/application/plan/revision';
import { approvedRevision } from '@/application/plan/revision-ledger';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { Plan } from '@/domain/plan/plan.generated';

type Ledger = NonNullable<Plan['meta']['revisions']>;

export interface Versioned {
  /** The plan as it stands, with its ledger. */
  readonly plan: Plan;
  /** What the versions chapter reads besides the model. */
  readonly versions: VersionsData;
  /** The earlier versions as they were written, by version. */
  readonly snapshots: Readonly<Record<string, Plan>>;
}

const drawn = (overlay: PlanOverlay): Plan => planOnAcme(overlay).plan;

/** The head plan with its ledger, and the revision built from the snapshots, the way planRevision builds it. */
function versioned(head: Plan, snapshots: Readonly<Record<string, Plan>>): Versioned {
  const plans = { ...snapshots };
  const approved = plans[approvedRevision(head)?.version ?? ''] ?? null;
  const revision = buildRevision(head, approved, { plans, snapshots: Object.keys(plans) });
  return {
    plan: head,
    versions: { revision, delivery: deliveryOf(head, {}, approved) },
    snapshots: plans,
  };
}

const GIFT_WRAP_LEDGER: Ledger = [
  {
    version: '1.0',
    status: 'approved',
    date: '2026-05-10',
    approved_on: '2026-05-12',
    approved_by: '@web-lead',
    summary: 'Wrapping chosen on the basket.',
  },
  {
    version: '1.1',
    status: 'rejected',
    date: '2026-05-18',
    rejected_on: '2026-05-20',
    summary: 'Payments prices the wrapping.',
    reason: 'Payments takes money; it does not set prices.',
    by: ['team:payments'],
  },
  {
    version: '1.2',
    status: 'proposed',
    date: '2026-05-25',
    summary: 'A sheet of its own for the wrapping.',
    why: 'The basket has no room for the papers.',
    pr: 17,
  },
];

/** Gift wrap at 1.0: no change to how the order is created, and a bigger order work item. */
function giftWrap10(): PlanOverlay {
  const overlay = giftWrapOverlay();
  const [step] = overlay.changes ?? [];
  if (step !== undefined) {
    const [first, ...rest] = step.ops.filter(
      (op) => !('modify' in op && op.modify === 'flow:place-order#create'),
    );
    if (first !== undefined) step.ops = [first, ...rest];
  }
  overlay.problem.why = 'Customers ask support for gift wrapping before Christmas.';
  const order = overlay.work_items?.find((w) => w.id === 'wi:wrap-order');
  if (order !== undefined) order.size = 'M';
  return { ...overlay, meta: { ...overlay.meta, version: '1.0' } };
}

/** Gift wrap at 1.1, rejected: Payments would have priced the wrapping. */
function giftWrap11(): PlanOverlay {
  const overlay = giftWrap10();
  const order = overlay.work_items?.find((w) => w.id === 'wi:wrap-order');
  if (order !== undefined) {
    order.team = 'team:payments';
    order.title = 'Payments prices the wrapping';
  }
  return { ...overlay, meta: { ...overlay.meta, version: '1.1' } };
}

/** Gift wrap at 1.2, proposed, after an approved 1.0 and a rejected 1.1. */
export function giftWrapVersioned(): Versioned {
  const head = drawn(giftWrapOverlay());
  head.meta = { ...head.meta, version: '1.2', revisions: GIFT_WRAP_LEDGER };
  return versioned(head, { '1.0': drawn(giftWrap10()), '1.1': drawn(giftWrap11()) });
}

const ORDER_EVENT_LEDGER: Ledger = [
  {
    version: '1.0',
    status: 'approved',
    date: '2026-05-20',
    approved_on: '2026-05-21',
    summary: 'Publish v2 next to v1.',
  },
  {
    version: '1.1',
    status: 'proposed',
    date: '2026-05-28',
    summary: 'Remove v1 once everyone reads v2.',
  },
];

/** order.placed v2 at 1.1, proposed: the approved 1.0 kept v1 for good. */
export function orderEventVersioned(): Versioned {
  const head = drawn(orderEventV2Overlay());
  head.meta = { ...head.meta, version: '1.1', revisions: ORDER_EVENT_LEDGER };
  const earlier = orderEventV2Overlay();
  earlier.changes = (earlier.changes ?? []).filter((c) => c.id !== 'chg:retire-v1');
  earlier.work_items = (earlier.work_items ?? []).filter((w) => w.id !== 'wi:retire-v1');
  earlier.milestones = (earlier.milestones ?? []).filter((m) => m.id !== 'ms:moved');
  return versioned(head, { '1.0': drawn(earlier) });
}
