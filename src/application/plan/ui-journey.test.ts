import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { uiJourney } from '@/application/plan/ui-journey';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('shop.yaml'));

describe('uiJourney', () => {
  it('lists the screens a flow passes through, with the steps and regions on each', () => {
    expect(uiJourney(model, 'flow:browse', 'toBe')).toEqual([
      {
        screen: 'scr:pdp',
        steps: [0],
        stepIds: ['flow:browse#open'],
        regions: ['scr:pdp#hero'],
      },
    ]);
  });

  it('is empty for a flow that names no screen, and for one that is not there', () => {
    expect(uiJourney(model, 'flow:price-purge', 'toBe')).toEqual([]);
    expect(uiJourney(model, 'flow:nope')).toEqual([]);
  });

  it('reads to-be, then as-is, without a mode', () => {
    expect(uiJourney(model, 'flow:add')).toEqual(uiJourney(model, 'flow:add', 'toBe'));
  });

  it('keeps consecutive steps on one screen together, with each region once', async () => {
    const plan = await loadFixture('shop.yaml');
    const first = plan.flows?.find((f) => f.id === 'flow:browse')?.steps[0];
    if (first === undefined) throw new Error('no step');
    const flow = plan.flows?.find((f) => f.id === 'flow:browse');
    flow?.steps.push(
      { ...first, id: 'flow:browse#again' },
      { ...first, id: 'flow:browse#cart', screen: 'scr:pdp#cart' },
    );
    const [leg, ...rest] = uiJourney(derive(plan), 'flow:browse', 'toBe');
    expect(rest).toEqual([]);
    expect(leg?.steps).toEqual([0, 1, 2]);
    expect(leg?.regions).toEqual(['scr:pdp#hero', 'scr:pdp#cart']);
  });
});
