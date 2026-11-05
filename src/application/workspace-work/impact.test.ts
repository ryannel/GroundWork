import { beforeEach, describe, expect, it } from 'vitest';

import { careInput } from '@/../test/fixtures/plan-index';

import { impactHeading, impactRowsOf, impactVM, ownerWords, systemImpactRows } from './impact';
import { type WorkspacePlanIndex, workspacePlanIndexOf } from './workspace-plan-index';

let index: WorkspacePlanIndex;

beforeEach(() => {
  index = workspacePlanIndexOf(careInput());
});

describe('impactRowsOf', () => {
  it('words each pending item on a system: who owns it, the plan it is in, and how it stands', () => {
    const impact = impactVM(index, { kind: 'system', id: 'sys:finance', name: 'Finance' });
    const groups = impact === null ? [] : impactRowsOf(index, impact);
    expect(groups.map((g) => g.state)).toEqual(['now']);
    expect(groups[0]?.rows).toEqual([
      {
        key: 'financing/wi:events',
        owner: 'Orders owns',
        partner: false,
        title: 'Send status events',
        href: '/acme/plans/financing/things/?id=wi-events',
        plan: { title: 'Financing status', href: '/acme/plans/financing/' },
        state: 'in progress',
        reason: null,
      },
      {
        key: 'listing/wi:listing',
        owner: 'Orders owns',
        partner: false,
        title: 'Show stock cars',
        href: '/acme/plans/listing/things/?id=wi-listing',
        plan: { title: 'Listing page', href: '/acme/plans/listing/' },
        state: 'not started',
        reason: null,
      },
      {
        key: 'order-change/wi:quote',
        owner: 'Ziklo owns · we depend on this',
        partner: true,
        title: 'Provide the order-change quote',
        href: '/acme/plans/order-change/things/?id=wi-quote',
        plan: { title: 'Change an order', href: '/acme/plans/order-change/' },
        state: 'in progress',
        reason: null,
      },
    ]);
  });

  it('says what holds blocked work up, and words a promise with no progress yet', () => {
    const impact = impactVM(index, { kind: 'team', id: 'team:orders' });
    const groups = impact === null ? [] : impactRowsOf(index, impact);
    const blocked = groups.find((g) => g.state === 'blocked')?.rows[0];
    expect(blocked).toMatchObject({
      key: 'order-change/wi:revise',
      state: 'not started',
      reason: 'Open question: What shape is the quote?',
    });
    const promised = workspacePlanIndexOf({
      ...careInput(),
      plans: careInput().plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) => ({ ...w, progress: null })),
        },
      })),
    });
    const ziklo = impactVM(promised, { kind: 'team', id: 'team:ziklo' });
    const rows = ziklo === null ? [] : impactRowsOf(promised, ziklo).flatMap((g) => g.rows);
    expect(rows.map((r) => r.state)).toEqual(['commitment accepted']);
  });

  it('falls back to the work’s state when a blocked item names no blocker', () => {
    const stuck = workspacePlanIndexOf({
      ...careInput(),
      plans: careInput().plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) =>
            w.item.id === 'wi:listing'
              ? { ...w, progress: { state: 'blocked' as const, at: '2026-11-01', source: null } }
              : w,
          ),
        },
      })),
    });
    const impact = impactVM(stuck, { kind: 'team', id: 'team:orders' });
    const rows = impact === null ? [] : impactRowsOf(stuck, impact);
    expect(rows.find((g) => g.state === 'blocked')?.rows.map((r) => [r.key, r.reason])).toEqual([
      ['listing/wi:listing', 'blocked'],
      ['order-change/wi:revise', 'Open question: What shape is the quote?'],
    ]);
  });
});

describe('ownerWords', () => {
  it('names the owning team, and says we depend on a partner', () => {
    expect(ownerWords({ id: 'team:a', name: 'Orders', partner: false })).toBe('Orders owns');
    expect(ownerWords({ id: 'team:z', name: 'Ziklo', partner: true })).toBe(
      'Ziklo owns · we depend on this',
    );
  });

  it('heads each group with what it means', () => {
    expect(['now', 'next', 'then', 'blocked'].map((s) => impactHeading(s as never))).toEqual([
      'Now: nothing it waits on is still to do',
      'Next: once the work above is done',
      'Then: after that',
      'Blocked: held up until something is settled',
    ]);
  });

  it('reads a system’s rows straight from the index, and none without one', () => {
    const rows = systemImpactRows(index, { id: 'sys:finance', name: 'Finance' });
    expect(rows.flatMap((g) => g.rows.map((r) => r.key))).toHaveLength(3);
    expect(systemImpactRows(null, { id: 'sys:finance', name: 'Finance' })).toEqual([]);
  });
});
