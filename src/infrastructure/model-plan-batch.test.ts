import { describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { plansIndex } from '@/application/plans-index';
import type { ModelOp } from '@/domain/plan-apply';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { modelValidator } from './model-schema';
import { validatePlanProjection, validatePlanProjections } from './validate-model';

vi.mock(import('server-only'), () => ({}));
const checkOp: (value: unknown) => value is ModelOp = await modelValidator('plan', 'op');

function currentModel(): WorkspaceModel {
  const model = queryModel();
  return {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({ ...system, connections: [] })),
    })),
  };
}
function plan(id: string, ops: readonly unknown[], buildsOn: readonly string[] = []): ModelPlan {
  const checkedOps = ops.map((op) => {
    if (!checkOp(op)) throw new Error('Invalid fixture operation');
    return op;
  });
  return {
    meta: { id, title: id },
    problem: { summary: 'Synthetic Care dependency and diamond proof.' },
    builds_on: buildsOn,
    changes: [{ id: 'chg:fixture', title: 'Change the fixture', ops: checkedOps }],
  };
}
const financing = plan('plan:financing-status', [
  {
    add: 'component',
    into: 'sys:a',
    value: { id: 'app:retail-sales-tool', name: 'Retail Sales Tool', kind: 'app', form: 'admin' },
  },
]);
const sales = plan(
  'plan:sales-tool',
  [
    {
      add: 'handler',
      into: 'sys:a',
      value: {
        id: 'h:retail-sale',
        component: 'app:retail-sales-tool',
        on: 'api:a',
        steps: [{ id: 'save', write: 'sch:remote#id', to: 'st:remote' }],
      },
    },
  ],
  [financing.meta.id],
);
const rates = plan(
  'plan:rates',
  [{ modify: 'api:a', set: { summary: 'Financing rate check' } }],
  [financing.meta.id],
);
const orderChange = plan(
  'plan:order-change',
  [{ modify: 'app:retail-sales-tool', set: { name: 'Retail Sales Tool with order changes' } }],
  [sales.meta.id, rates.meta.id],
);

describe('canonical plan batch dependency validation', () => {
  it('composes only explicit Care ancestors, applying a shared diamond ancestor once', async () => {
    const current = currentModel();
    const before = JSON.stringify(current);
    const single = await validatePlanProjection(orderChange, current);
    expect(single.projection).toBeNull();
    expect(single.problems[0]?.message).toContain('app:retail-sales-tool');
    const batch = await validatePlanProjections([orderChange, sales, rates, financing], current);
    expect(batch.problems).toEqual([]);
    expect(batch.plans).toHaveLength(4);
    const child = batch.plans.find((checked) => checked.id === orderChange.meta.id);
    expect(child?.proposals).toContainEqual({
      id: 'h:retail-sale#save',
      plan: sales.meta.id,
      change: 'chg:fixture',
      op: 0,
    });
    expect(child?.proposals).toHaveLength(1);
    expect(JSON.stringify(current)).toBe(before);
  });
  it('does not use an unrelated plan to satisfy story references', async () => {
    const unrelated = plan('plan:unrelated', [
      {
        add: 'component',
        into: 'sys:a',
        value: { id: 'svc:unrelated', kind: 'service', name: 'Unrelated' },
      },
    ]);
    const child = { ...orderChange, story: { scope: ['svc:unrelated'] } };
    const batch = await validatePlanProjections(
      [financing, sales, rates, unrelated, child],
      currentModel(),
    );
    expect(batch.problems).toContainEqual({
      at: 'plan:order-change/story/scope/0',
      message: 'Unresolved plan story reference: svc:unrelated.',
    });
  });
  it('keeps derived proposed context barred from the strict single-plan current-base boundary', async () => {
    const current = currentModel();
    const first = plansIndex([financing], current).plans[0];
    if (first === undefined) throw new Error('Missing fixture financing projection');
    const derived = plansIndex([sales], first.after).plans[0];
    if (derived === undefined) throw new Error('Missing fixture sales projection');
    const result = await validatePlanProjection(orderChange, derived.after);
    expect(result.projection).toBeNull();
    expect(result.problems).toContainEqual({
      at: 'h:retail-sale#save',
      message:
        'Proposed behaviour requires implementation evidence before it can become current facts.',
    });
  });
  it('rejects missing and cyclic explicit dependencies', async () => {
    const missing = plan('plan:missing-parent', [], ['plan:absent']);
    const a = plan('plan:a', [], ['plan:b']);
    const b = plan('plan:b', [], ['plan:a']);
    const batch = await validatePlanProjections([missing, a, b], currentModel());
    expect(batch.problems).toHaveLength(3);
    expect(batch.problems[0]?.message).toBe('Missing plan dependency: plan:absent.');
    expect(
      batch.problems
        .slice(1)
        .every((problem) => problem.message.startsWith('Cyclic plan dependency:')),
    ).toBe(true);
  });
  it('does not let ancestor list order resolve unordered conflicting changes', async () => {
    const left = plan('plan:left', [{ modify: 'api:a', set: { summary: 'Left choice' } }]);
    const right = plan('plan:right', [{ modify: 'api:a', set: { summary: 'Right choice' } }]);
    const child = plan('plan:child', [], [left.meta.id, right.meta.id]);
    const batch = await validatePlanProjections([left, right, child], currentModel());
    expect(batch.problems).toContainEqual({
      at: child.meta.id,
      message: 'Unordered plan ancestors plan:left and plan:right overlap on api:a.',
    });
  });
  it('rejects an invalid current base before plans can repair its facts', async () => {
    const current = currentModel();
    const invalid = {
      ...current,
      problems: [
        { id: 'h:unknown', kind: 'proposed_effect', message: 'Unverified current effect' },
      ],
    };
    const batch = await validatePlanProjections([financing], invalid);
    expect(batch.plans).toEqual([]);
    expect(batch.problems).toHaveLength(1);
  });
});

it('keeps proposed context barred from a supplied frozen-current base', async () => {
  const current = currentModel();
  const financed = plansIndex([financing], current).plans[0];
  if (financed === undefined) throw new Error('Missing financing fixture');
  const proposed = plansIndex([sales], financed.after).plans[0];
  if (proposed === undefined) throw new Error('Missing proposed fixture');
  const batch = await validatePlanProjections([financing], current, {
    frozenBases: new Map([[financing.meta.id, proposed.after]]),
  });
  expect(batch.problems).toContainEqual({
    at: 'h:retail-sale#save',
    message:
      'Proposed behaviour requires implementation evidence before it can become current facts.',
  });
});
