import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { problemHead, promiseView, scenariosView } from '@/application/plan-story-why';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const base = await loadFixture('mini.yaml');

const withProblem = (problem: Partial<typeof base.problem>, meta: Partial<typeof base.meta> = {}) =>
  derive({ ...base, problem: { ...base.problem, ...problem }, meta: { ...base.meta, ...meta } });

describe('problemHead', () => {
  it('splits a long claim at the first natural break', () => {
    const claim =
      'Shoppers abandon the basket at the payment step because the page asks for the same address twice';
    const head = problemHead(
      derive({ ...base, story: { chapters: { why: { headline: claim } } } }),
    );
    expect(head.headline).toBe('Shoppers abandon the basket at the payment step');
    expect(head.lede).toBe('Because the page asks for the same address twice');
  });

  it('keeps a short claim whole and falls back to the evidence', () => {
    const model = derive({
      ...base,
      story: { chapters: {} },
      problem: { ...base.problem, why: 'Orders are lost. More words follow.' },
    });
    expect(problemHead(model)).toEqual({ headline: 'Orders are lost.', lede: '' });
  });
});

describe('promiseView', () => {
  it('says the first goal inside the time budget', () => {
    const model = withProblem(
      { goals: ['Reserve stock.', 'Tell shoppers.'], non_goals: [] },
      { appetite: '6 weeks · one team' },
    );
    const view = promiseView(model);
    expect(view.headline).toBe('In 6 weeks, reserve stock.');
    expect(view.promises).toEqual(['Tell shoppers.']);
    expect(view.promisesLabel).toBe('We also promise');
  });

  it('draws two columns for a single promise and handles no goals', () => {
    const one = promiseView(withProblem({ goals: ['Reserve stock'] }, { appetite: '' }));
    expect(one.headline).toBe('Reserve stock.');
    expect(one.showPromises).toBe(false);
    const none = promiseView(withProblem({ goals: [] }, { appetite: '2 weeks' }));
    expect(none.headline).toBe('The time budget is 2 weeks.');
    expect(none.showPromises).toBe(true);
    expect(none.promisesLabel).toBe('We promise');
  });
});

describe('scenariosView', () => {
  it('says the scenarios need a flow that does not exist yet', () => {
    const [flow] = base.flows ?? [];
    const model = withProblem({
      scenarios: [{ id: 'sc:one', title: 'One', story: 'A story', flows: flow ? [flow.id] : [] }],
    });
    expect(scenariosView(model).cards).toHaveLength(1);
    expect(scenariosView(model).headline).toMatch(/One|scenario/);
  });

  it('names the scenario when it has no flows', () => {
    const model = withProblem({ scenarios: [{ id: 'sc:one', title: 'One', flows: [] }] });
    expect(scenariosView(model).headline).toBe('One: the one this plan must make work.');
    expect(scenariosView(model).lede).toBe('');
  });
});
