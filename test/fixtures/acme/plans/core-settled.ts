// A plan whose only version is approved, so nothing is proposed: what the revision and proposed tests read
// when there is no live proposal.
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import type { Plan } from '@/domain/plan/plan.generated';

export interface Settled {
  readonly plan: Plan;
  /** The approved version as it was written, by version. */
  readonly snapshots: Readonly<Record<string, Plan>>;
}

/** Pause orders at 1.0, approved, with that version kept as a snapshot. */
export function settledPauseOrders(): Settled {
  const plan = pauseOrders();
  plan.meta.version = '1.0';
  plan.meta.revisions = [
    {
      version: '1.0',
      status: 'approved',
      date: '2026-05-01',
      approved_on: '2026-05-02',
      approved_by: '@ops-lead',
      summary: 'Pause orders from the admin tool.',
    },
  ];
  return { plan, snapshots: { '1.0': structuredClone(plan) } };
}
