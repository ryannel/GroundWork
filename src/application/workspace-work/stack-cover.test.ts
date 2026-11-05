import { beforeEach, describe, expect, it } from 'vitest';

import { careInput, STACKED_BASE } from '@/../test/fixtures/plan-index';
import { NO_BASE } from '@/application/plan/plan-base';

import { stackCoverVM } from './stack-cover';
import { type WorkspacePlanIndex, workspacePlanIndexOf } from './workspace-plan-index';

let index: WorkspacePlanIndex;

beforeEach(() => {
  index = workspacePlanIndexOf(careInput());
});

describe('stackCoverVM', () => {
  it('says what a stacked plan reads after, what is not delivered there, its overlaps and how to re-check', () => {
    expect(stackCoverVM(index, 'order-change', STACKED_BASE)).toEqual({
      readsAfter: [
        {
          slug: 'financing',
          title: 'Financing status',
          href: '/acme/plans/financing/',
          changed: false,
        },
      ],
      checkedOn: '2026-10-25',
      inheritedWork: [
        {
          plan: {
            slug: 'financing',
            title: 'Financing status',
            href: '/acme/plans/financing/',
            changed: false,
          },
          items: [index.work.get('financing/wi:events')?.card],
        },
      ],
      overlaps: [
        {
          target: 'svc:status',
          kind: 'modify-modify',
          words: 'Both change',
          here: {
            plan: 'order-change',
            planTitle: 'Change an order',
            change: 'chg:quote',
            title: 'Ziklo quotes a change',
            href: '/acme/plans/order-change/things/?id=chg-quote',
          },
          there: {
            plan: 'listing',
            planTitle: 'Listing page',
            change: 'chg:status-copy',
            title: 'Listing reads the status',
            href: '/acme/plans/listing/things/?id=chg-status-copy',
          },
        },
      ],
      programme: { id: 'care', title: 'Care in Sweden', href: '/acme/programmes/care/' },
      recheck: 'npm run plan:base -- check order-change --workspace acme',
    });
  });

  it('sees each overlap from the plan being read', () => {
    const vm = stackCoverVM(index, 'listing', NO_BASE);
    expect(vm?.overlaps[0]?.here.plan).toBe('listing');
    expect(vm?.overlaps[0]?.there.plan).toBe('order-change');
    expect(vm?.readsAfter).toEqual([]);
    expect(vm?.programme).toBeNull();
  });

  it('says a base that changed since the check, and leaves out a base whose work is all done', () => {
    const base = {
      ...STACKED_BASE,
      builtOn: [{ slug: 'financing', title: 'Financing status', changed: true }],
    };
    const done = careInput();
    const delivered = workspacePlanIndexOf({
      ...done,
      plans: done.plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) => ({
            ...w,
            progress: { state: 'done' as const, at: '2026-11-01', source: null },
          })),
        },
      })),
    });
    const vm = stackCoverVM(delivered, 'order-change', base);
    expect(vm?.readsAfter[0]?.changed).toBe(true);
    expect(vm?.inheritedWork).toEqual([]);
  });

  it('is null for a plan on its own, and names a base or programme the index lacks by its id', () => {
    expect(stackCoverVM(index, 'financing', { ...NO_BASE, mode: 'live' })?.programme?.title).toBe(
      'Care in Sweden',
    );
    const alone = workspacePlanIndexOf({ ...careInput(), programmes: [] });
    expect(stackCoverVM(alone, 'financing', NO_BASE)?.programme).toEqual({
      id: 'care',
      title: 'care',
      href: '/acme/programmes/care/',
    });
    const lonely = workspacePlanIndexOf({ ...careInput(), plans: [] });
    expect(stackCoverVM(lonely, 'x', NO_BASE)).toBeNull();
    const vm = stackCoverVM(lonely, 'x', {
      ...NO_BASE,
      builtOn: [{ slug: 'gone', title: 'Gone', changed: false }],
    });
    expect(vm?.readsAfter[0]?.href).toBe('/acme/plans/gone/');
    expect(vm?.inheritedWork).toEqual([]);
  });
});
