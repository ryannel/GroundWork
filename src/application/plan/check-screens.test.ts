import { describe, expect, it, vi } from 'vitest';

import { validatePlan } from '@/application/plan/validate-plan';
import type { Interaction, Plan, Screen } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const screen = (id: string, over: Partial<Screen> = {}): Screen => ({
  id,
  name: id,
  service: 'svc:web',
  kind: 'page',
  image: 'assets/x.svg',
  ...over,
});
const interaction = (id: string, over: Partial<Interaction>): Interaction => ({
  id,
  name: id,
  from: ['scr:a'],
  to: 'scr:b',
  trigger: 'click',
  effect: 'navigate',
  ...over,
});

async function withScreens(edit?: (p: Plan) => void): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.screens = [
    screen('scr:a'),
    screen('scr:b'),
    screen('scr:modal', { kind: 'modal' }),
    screen('scr:mail', { kind: 'email', service: 'svc:subs' }),
  ];
  edit?.(p);
  return p;
}
const errorsOf = async (edit?: (p: Plan) => void) => validatePlan(await withScreens(edit)).errors;
const warningsOf = async (edit?: (p: Plan) => void) =>
  validatePlan(await withScreens(edit)).warnings;
const messages = (list: { message: string }[]) => list.map((e) => e.message);
const errorsFor = async (items: Interaction[]) =>
  errorsOf((p) => {
    Object.assign(p, { interactions: items });
  }).then(messages);
const journey = (ids: [string, ...string[]]) => ({ id: 'uj:x', name: 'X', interactions: ids });

describe('screens', () => {
  it('validates clean when every screen is well placed', async () => {
    expect(await errorsOf()).toEqual([]);
    expect(await warningsOf()).toHaveLength(1);
  });
  it('warns when a page is served by something other than a ui service, and when the image is missing', async () => {
    const warnings = await warningsOf((p) => {
      Object.assign(p, {
        screens: [screen('scr:a', { service: 'svc:subs' }), screen('scr:b', { image: '' })],
      });
    });
    expect(messages(warnings).join('\n')).toMatch(/scr:a is a page, but svc:subs is a service/);
    expect(messages(warnings).join('\n')).toMatch(/scr:b has no image/);
  });
  it('refuses a region that runs off the picture', async () => {
    const errors = await errorsOf((p) => {
      Object.assign(p, {
        screens: [
          screen('scr:a', {
            regions: [
              { id: 'scr:a#wide', name: 'Wide', at: { x: 60, y: 0, w: 50, h: 10 } },
              { id: 'scr:a#fine', name: 'Fine', at: { x: 0, y: 0, w: 50, h: 10 } },
              { id: 'scr:a#bare', name: 'Bare' },
            ],
          }),
        ],
      });
    });
    expect(messages(errors)).toEqual([
      expect.stringMatching(/scr:a#wide\.at runs off the picture/),
    ]);
  });
  it('wants a step to happen on a screen of one of its own services', async () => {
    const errors = await errorsOf((p) => {
      const step = p.flows?.[1]?.steps[0];
      if (step) step.screen = 'scr:a';
    });
    expect(messages(errors).join('\n')).toMatch(/happens on scr:a, which svc:web serves/);
  });
});

describe('navigation', () => {
  it('accepts navigate between pages, update within one, output to an email', async () => {
    expect(
      await errorsFor([
        interaction('ui:go', {}),
        interaction('ui:open', { to: 'scr:modal' }),
        interaction('ui:edit', { effect: 'update', to: 'scr:a' }),
        interaction('ui:mail', { effect: 'output', to: 'scr:mail' }),
      ]),
    ).toEqual([]);
  });
  it('refuses an output to a page and navigation to an email', async () => {
    const errors = await errorsFor([
      interaction('ui:out', { effect: 'output' }),
      interaction('ui:nav', { to: 'scr:mail' }),
    ]);
    expect(errors.join('\n')).toMatch(/ui:out produces an output, but scr:b is a page/);
    expect(errors.join('\n')).toMatch(/ui:nav navigates to scr:mail, a email/);
  });
  it('refuses navigating back to the same screen and updates that leave it', async () => {
    const errors = await errorsFor([
      interaction('ui:same', { to: 'scr:a' }),
      interaction('ui:up', { effect: 'update' }),
      interaction('ui:two', { effect: 'update', from: ['scr:a', 'scr:b'], to: 'scr:a' }),
    ]);
    expect(errors.join('\n')).toMatch(/ui:same navigates back to the same screen/);
    expect(errors.join('\n')).toMatch(/ui:up updates a screen, so it needs one source/);
    expect(errors.join('\n')).toMatch(/ui:two updates a screen/);
  });
  it('reads a region as the screen it sits on', async () => {
    const errors = await errorsOf((p) => {
      Object.assign(p, {
        screens: [screen('scr:a', { regions: [{ id: 'scr:a#r', name: 'R' }] }), screen('scr:b')],
      });
      Object.assign(p, {
        interactions: [interaction('ui:in', { from: ['scr:a#r'], effect: 'update', to: 'scr:a' })],
      });
    });
    expect(errors).toEqual([]);
  });
  it('wants a journey to be a connected path', async () => {
    const errors = await errorsOf((p) => {
      Object.assign(p, {
        interactions: [
          interaction('ui:1', {}),
          interaction('ui:2', { from: ['scr:modal'], to: 'scr:a' }),
          interaction('ui:3', { from: ['scr:b'], to: 'scr:modal' }),
        ],
      });
      Object.assign(p, {
        user_journeys: [journey(['ui:1', 'ui:3']), { ...journey(['ui:1', 'ui:2']), id: 'uj:y' }],
      });
    });
    expect(messages(errors)).toEqual([
      expect.stringMatching(/uj:y cannot continue from ui:1 to ui:2/),
    ]);
  });
});
