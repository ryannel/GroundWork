import { describe, expect, it, vi } from 'vitest';

import { buildSummary } from '@/application/plan-viz-milestone';
import { PLANS } from '@/features/plan/chapters/chapter-kit';

import { orderHeadline, waveViews, workHeadline } from './plan-story-build';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function read(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no ${plan}`);
  const sum = buildSummary(data.model);
  return { model: data.model, sum };
}

const HEADLINES: Readonly<Record<string, readonly [string, string]>> = {
  'delivery-promise': [
    'M1 waits on Fulfilment’s Build the Promise service; the critical path then runs through Checkout and Orders.',
    'Fulfilment carries the critical path: 3 of 20 work items, one XL.',
  ],
  'invoice-vat-number': [
    'Storefront, Billing and Checkout have work left for M1 (due 16 Oct); 2 of 5 done. The critical path runs through Billing.',
    'Storefront, Billing and Checkout have the 3 work items still to do.',
  ],
  'stock-reservation': [
    'Delivered: all 7 work items done; the last milestone closed 27 Aug.',
    'Fulfilment built most of it: 5 of 7 work items.',
  ],
  'storefront-graph': [
    'M1 waits on Storefront’s Cache purger; the critical path then runs through Fulfilment and Product management.',
    'Storefront carries the critical path: 5 of 14 work items.',
  ],
};

describe('build headlines', () => {
  it.each(PLANS)('says one claim for the order and one for the work in %s', async (plan) => {
    const { model, sum } = await read(plan);
    expect([orderHeadline(model, sum, model.waves()), workHeadline(model, sum)]).toEqual(
      HEADLINES[plan],
    );
  });

  it('puts every work item in one wave and completes each milestone once before delivery', async () => {
    for (const plan of PLANS) {
      const { model, sum } = await read(plan);
      const views = waveViews(model, sum, false);
      expect(views.flatMap((v) => v.ids).toSorted((a, b) => a.localeCompare(b))).toEqual(
        sum.items.map((w) => w.id).toSorted((a, b) => a.localeCompare(b)),
      );
      expect(views.flatMap((v) => v.checkpoints)).toHaveLength(
        sum.delivered ? 0 : sum.milestones.length,
      );
      expect(views[0]?.hint).toBe('First, once approved');
    }
  });

  it('says a wave can start now once the plan is approved', async () => {
    const { model, sum } = await read('delivery-promise');
    expect(waveViews(model, sum, true)[0]?.hint).toBe('Can start now');
    expect(waveViews(model, sum, true)[1]?.hint).toBe('Starts when wave 1 is done');
  });

  it('folds a finished wave', async () => {
    const { model, sum } = await read('stock-reservation');
    expect(waveViews(model, sum, true).every((v) => v.finished)).toBe(true);
    expect(waveViews(model, sum, true)[0]?.label).toBe('Wave 1 · done');
  });
});
