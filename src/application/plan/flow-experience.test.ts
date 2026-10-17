import { describe, expect, it, vi } from 'vitest';

import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { modelOf } from '@/../test/plan-kit';
import { derive, type Model } from '@/application/plan/derive';
import { flowExperience } from '@/application/plan/flow-experience';
import { flowSteps } from '@/application/plan/flow-steps';
import type { Change, Plan, Step } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

type StepSpec = Partial<Step>;

/** The mini plan with a web app, an api and a handful of screens, and one flow of the given steps. */
async function fixture(steps: StepSpec[], changes: Change[] = []): Promise<Model> {
  const plan: Plan = await loadFixture('mini.yaml');
  plan.screens = [
    {
      id: 'scr:a',
      name: 'A',
      kind: 'page',
      service: 'svc:web',
      regions: [{ id: 'scr:a#submit', name: 'Submit' }],
    },
    { id: 'scr:b', name: 'B', kind: 'modal', service: 'svc:web' },
    { id: 'scr:odd', name: 'Odd', service: 'svc:web' },
    ...(['email', 'print', 'push'] as const).map((kind) => ({
      id: `scr:${kind}`,
      name: kind,
      kind,
      service: 'svc:subs',
    })),
  ];
  plan.flows = [
    {
      id: 'flow:f',
      name: 'F',
      steps: steps.map((s, i) => ({
        id: `flow:f#${String(i)}`,
        action: `Action ${String(i)}`,
        from: 'svc:web',
        to: 'svc:subs',
        via: 'internal',
        ...s,
      })),
    },
  ];
  plan.changes = changes;
  return derive(plan);
}

describe('flowExperience', () => {
  it('classifies direction and output kind without guessing from action words', async () => {
    const m = await fixture([
      { screen: 'scr:a#submit' },
      { screen: 'scr:a', from: 'svc:subs', to: 'svc:web' },
      { screen: 'scr:email' },
      { screen: 'scr:print' },
      { screen: 'scr:push' },
      { screen: 'scr:unknown', action: 'Click the button' },
      { screen: 'scr:odd', action: 'Click the button' },
      { screen: 'scr:a', from: 'svc:billing', to: 'svc:subs' },
      { screen: 'scr:a', from: 'svc:web', to: 'svc:web' },
    ]);
    const moments = flowExperience(m, 'flow:f');
    expect(moments.map((x) => x.kind)).toEqual([
      'action',
      'update',
      'output',
      'output',
      'output',
      'linked',
      'linked',
      'linked',
      'update',
    ]);
    expect(moments[0]?.region).toBe('scr:a#submit');
    expect(moments[1]?.region).toBeNull();
    expect(moments[5]?.title).toBe('Click the button');
  });

  it('keeps each screen moment and every intervening step once, including branches', async () => {
    const m = await fixture([
      {},
      {},
      { screen: 'scr:a' },
      {},
      { from: 'st:sub-events', to: 'svc:billing' },
      { from: 'st:sub-events', to: 'svc:analytics', logic: 'Only for financed orders.' },
      { screen: 'scr:a', from: 'svc:subs', to: 'svc:web' },
      { screen: 'scr:b' },
      { screen: 'scr:a' },
      {},
    ]);
    const moments = flowExperience(m, 'flow:f');
    expect(moments.map((x) => x.indices)).toEqual([[0, 1], [2, 3, 4, 5], [6], [7], [8, 9]]);
    expect(moments.map((x) => x.screen)).toEqual([null, 'scr:a', 'scr:a', 'scr:b', 'scr:a']);
    expect(moments.map((x) => x.anchor)).toEqual([0, 2, 6, 7, 8]);
    expect(moments[0]?.kind).toBe('background');
    expect(moments[0]?.title).toBe('Before the first screen');
    expect(moments.flatMap((x) => x.indices)).toEqual(Array.from({ length: 10 }, (_, i) => i));
  });

  it('does not fabricate a user journey for screenless and empty flows', async () => {
    expect(flowExperience(await fixture([{}, {}]), 'flow:f')).toEqual([]);
    const empty = await fixture([]);
    expect(flowExperience(empty, 'flow:f')).toEqual([]);
    expect(flowExperience(empty, 'flow:missing')).toEqual([]);
  });

  it('classifies against the selected snapshot and keeps removed screen moments in a diff', async () => {
    const m = await fixture(
      [{ screen: 'scr:a' }, { screen: 'scr:b' }],
      [
        {
          id: 'chg:rework',
          title: 'Rework',
          ops: [
            { modify: 'scr:a', set: { kind: 'email', service: 'svc:subs' } },
            { remove: 'flow:f#1' },
          ],
        },
      ],
    );
    expect(flowExperience(m, 'flow:f', 'asIs')[0]?.kind).toBe('linked');
    expect(flowExperience(m, 'flow:f', 'toBe')[0]?.kind).toBe('output');
    expect(flowExperience(m, 'flow:f', 'diff').map((x) => x.kind)).toEqual(['output', 'linked']);
  });
});

describe('flowExperience in a plan on Acme', () => {
  const m = modelOf(quickCheckoutOnToday().plan);

  it('separates paying on the basket, receiving the email and seeing the confirmation', () => {
    for (const mode of ['asIs', 'toBe', 'diff'] as const) {
      const steps = flowSteps(m, 'flow:place-order', mode);
      const moments = flowExperience(m, 'flow:place-order', mode);
      expect(moments.map((x) => x.kind)).toEqual(['action', 'output', 'update']);
      expect(moments.flatMap((x) => x.indices)).toEqual(steps.map((_, i) => i));
      expect(moments.map((x) => steps[x.anchor]?.id)).toEqual([
        'flow:place-order#submit',
        'flow:place-order#email',
        'flow:place-order#show',
      ]);
      expect(moments[0]).toMatchObject({ screen: 'scr:basket', region: 'scr:basket#pay' });
    }
  });

  it('starts adding a line on the product page and moves on when the basket is shown', () => {
    for (const mode of ['asIs', 'toBe'] as const) {
      const moments = flowExperience(m, 'flow:add-to-basket', mode);
      expect(moments[0]).toMatchObject({
        screen: 'scr:product-page',
        region: 'scr:product-page#buy',
      });
      expect(moments[1]?.screen).toBe('scr:basket');
    }
    expect(flowExperience(m, 'flow:add-to-basket', 'toBe')[0]?.indices).toEqual([0, 1, 2, 3]);
  });
});
