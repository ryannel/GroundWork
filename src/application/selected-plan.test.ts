import { describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelOp } from '@/domain/plan-apply';
import type { ModelPlan } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { entryFlowPageOf } from './entry-flow-page';
import { indexOf } from './model-index';
import { selectedPlanProjection } from './plans-index';

vi.mock(import('server-only'), () => ({}));
const checkOp: (value: unknown) => value is ModelOp = await modelValidator('plan', 'op');
function plan(id: string, ops: readonly unknown[], buildsOn: readonly string[] = []): ModelPlan {
  const checked = ops.map((op) => {
    if (!checkOp(op)) throw new Error('Invalid fixture operation');
    return op;
  });
  return {
    meta: { id, title: id },
    problem: { summary: 'Synthetic Care dependency projection.' },
    builds_on: buildsOn,
    changes: [{ id: 'chg:fixture', title: 'Change the fixture', ops: checked }],
  };
}
const financing = plan('plan:financing', [
  {
    add: 'component',
    into: 'sys:a',
    value: { id: 'app:retail', kind: 'app', form: 'admin', name: 'Retail tool' },
  },
]);
const sales = plan(
  'plan:sales',
  [
    {
      add: 'handler',
      into: 'sys:a',
      value: {
        id: 'h:retail',
        component: 'app:retail',
        on: 'api:a',
        steps: [{ id: 'send', call: 'api:supplier' }],
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
  [{ modify: 'h:retail#send', set: { when: 'The order change is approved' } }],
  [sales.meta.id, rates.meta.id],
);
const unrelated = plan('plan:unrelated', [
  {
    add: 'component',
    into: 'sys:a',
    value: { id: 'svc:unrelated', kind: 'service', name: 'Unrelated' },
  },
]);
const all = [orderChange, unrelated, rates, sales, financing];

describe('selected canonical plan context', () => {
  it('puts exactly the explicit shared ancestors before the selected plan', () => {
    const current = queryModel();
    const snapshot = structuredClone(current);
    const result = selectedPlanProjection(orderChange, all, current);
    expect(result.plan).toBe(orderChange);
    expect(result.beforeIndex.get('app:retail')?.data.name).toBe('Retail tool');
    expect(result.beforeIndex.get('h:retail#send')?.data.when).toBeUndefined();
    expect(result.afterIndex.get('h:retail#send')?.data.when).toBe('The order change is approved');
    expect(result.beforeIndex.get('svc:unrelated')).toBeNull();
    expect(result.afterIndex.get('svc:unrelated')).toBeNull();
    expect(result.afterIndex.entities.filter((node) => node.id === 'app:retail')).toHaveLength(1);
    expect(current).toEqual(snapshot);
  });
  it('reuses a supplied current index for the first projection and current entry view', () => {
    const current = queryModel();
    const index = indexOf(current);
    const result = selectedPlanProjection(financing, all, current, index);
    expect(result.beforeIndex).toBe(index);
    const view = entryFlowPageOf(current, all, { id: 'api:a' }, index);
    expect(view?.flow?.id).toBe('api:a');
  });
  it('keeps ancestor attribution in before and after, with selected effects owned by the selected plan', () => {
    const result = selectedPlanProjection(orderChange, all, queryModel());
    const beforeMessages = result.before.problems
      .filter((gap) => gap.id === 'h:retail#send' && gap.kind === 'proposed_effect')
      .map((gap) => gap.message);
    const afterMessages = result.after.problems
      .filter((gap) => gap.id === 'h:retail#send' && gap.kind === 'proposed_effect')
      .map((gap) => gap.message);
    expect(beforeMessages.some((message) => message.includes('plan:sales'))).toBe(true);
    expect(afterMessages.some((message) => message.includes('plan:sales'))).toBe(true);
    expect(afterMessages.some((message) => message.includes('plan:order-change'))).toBe(true);
    expect(result.proposals).toEqual([
      { id: 'h:retail#send', plan: orderChange.meta.id, change: 'chg:fixture', op: 0 },
    ]);
  });
  it('projects the same ancestor-aware before and after in entry flow views', () => {
    const before = entryFlowPageOf(queryModel(), all, {
      id: 'api:a',
      plan: orderChange.meta.id,
      version: 'before',
    });
    const after = entryFlowPageOf(queryModel(), all, {
      id: 'api:a',
      plan: orderChange.meta.id,
      version: 'after',
    });
    const beforeNodes = before?.flow?.handlers.find((handler) => handler.id === 'h:retail')?.nodes;
    const afterNodes = after?.flow?.handlers.find((handler) => handler.id === 'h:retail')?.nodes;
    expect(beforeNodes?.[0]?.condition).toBeNull();
    expect(afterNodes?.[0]?.condition).toBe('The order change is approved');
    expect(after?.flow?.gaps.some((gap) => gap.includes('plan:sales'))).toBe(true);
    expect(after?.comparison?.version).toBe('after');
  });
  it('fails visible dependency gaps and cycles rather than drawing a partial context', () => {
    const missing = plan('plan:missing', [], ['plan:absent']);
    expect(() => selectedPlanProjection(missing, [missing], queryModel())).toThrow(
      'Missing plan dependency: plan:absent.',
    );
    const a = plan('plan:a', [], ['plan:b']);
    const b = plan('plan:b', [], [a.meta.id]);
    expect(() => selectedPlanProjection(a, [a, b], queryModel())).toThrow(
      'Cyclic plan dependency: plan:a reaches plan:a.',
    );
  });
  it('uses the existing unordered-ancestor overlap policy in the UI projection', () => {
    const left = plan('plan:left', [{ modify: 'api:a', set: { summary: 'Left choice' } }]);
    const right = plan('plan:right', [{ modify: 'api:a', set: { summary: 'Right choice' } }]);
    const child = plan('plan:child', [], [left.meta.id, right.meta.id]);
    expect(() => selectedPlanProjection(child, [left, right, child], queryModel())).toThrow(
      'Unordered plan ancestors plan:left and plan:right overlap on api:a.',
    );
  });
});

it('uses implemented current facts for a landed dependency instead of replaying its add operations', () => {
  const implemented = selectedPlanProjection(financing, [financing], queryModel()).after;
  const selected = selectedPlanProjection(
    orderChange,
    all,
    implemented,
    indexOf(implemented),
    new Set([financing.meta.id]),
  );
  expect(selected.beforeIndex.get('app:retail')?.data.name).toBe('Retail tool');
  expect(selected.afterIndex.get('h:retail#send')?.data.when).toBe('The order change is approved');
});

it('treats a landed dependency as closed when its live plan later gains an open ancestor', () => {
  const implemented = selectedPlanProjection(financing, [financing], queryModel()).after;
  const later = plan('plan:later', [
    {
      add: 'component',
      into: 'sys:a',
      value: { id: 'svc:later', kind: 'service', name: 'Later work' },
    },
  ]);
  const changedParent = { ...financing, builds_on: [later.meta.id] };
  const plans = [
    ...all.filter((candidate) => candidate.meta.id !== financing.meta.id),
    changedParent,
    later,
  ];
  const selected = selectedPlanProjection(
    orderChange,
    plans,
    implemented,
    indexOf(implemented),
    new Set([financing.meta.id]),
  );
  expect(selected.beforeIndex.get('svc:later')).toBeNull();
  expect(selected.afterIndex.get('svc:later')).toBeNull();
});

it('keeps the original all-open projection when the landed set is empty', () => {
  const current = queryModel();
  const index = indexOf(current);
  const original = selectedPlanProjection(orderChange, all, current, index);
  const explicit = selectedPlanProjection(orderChange, all, current, index, new Set());
  expect(explicit.before).toEqual(original.before);
  expect(explicit.after).toEqual(original.after);
  expect(explicit.proposals).toEqual(original.proposals);
});

it('drills into an after-only entry without losing the selected plan or comparison mode', () => {
  const proposed = plan('plan:drill', [
    {
      add: 'endpoint',
      into: 'if:a',
      value: { id: 'api:proposed', method: 'POST', path: '/proposed' },
    },
    {
      add: 'handler',
      into: 'sys:a',
      value: {
        id: 'h:proposed',
        component: 'svc:a',
        on: 'api:proposed',
        steps: [{ id: 'done', return: 204 }],
      },
    },
    { modify: 'h:a#call', set: { call: 'api:proposed' } },
    {
      add: 'step',
      into: 'h:a',
      value: {
        id: 'proposed-branch',
        transaction: true,
        steps: [{ id: 'send', call: 'api:proposed' }],
      },
    },
  ]);
  const current = queryModel();
  const after = entryFlowPageOf(current, [proposed], {
    id: 'api:a',
    plan: proposed.meta.id,
    version: 'after',
  });
  const handler = after?.flow?.handlers.find((candidate) => candidate.id === 'h:a');
  const href = handler?.nodes.find((node) => node.id === 'h:a#call')?.drill?.href;
  expect(href).toBe('/queries/entries/?id=api-proposed&plan=plan-drill&version=after');
  const nested = handler?.nodes.find((node) => node.id === 'h:a#proposed-branch')?.branches[0]
    ?.nodes[0];
  expect(nested?.drill?.href).toBe(href);
  if (href === undefined) throw new Error('Missing proposed drill address');
  const address = new URL(href, 'https://fixture.example');
  const target = entryFlowPageOf(current, [proposed], Object.fromEntries(address.searchParams));
  expect(target?.flow?.id).toBe('api:proposed');
  expect(target?.flow?.handlers[0]?.id).toBe('h:proposed');
  expect(target?.comparison?.before).toBe(
    '/queries/entries/?id=api-proposed&plan=plan-drill&version=before',
  );
  expect(target?.comparison?.after).toBe(href);
  expect(target?.flow?.gaps.some((gap) => gap.includes('plan:drill'))).toBe(true);
  expect(
    entryFlowPageOf(current, [proposed], {
      id: 'api:proposed',
      plan: proposed.meta.id,
      version: 'before',
    }),
  ).toBeNull();
  expect(entryFlowPageOf(current, [], { id: 'api:proposed' })).toBeNull();
  const before = entryFlowPageOf(current, [proposed], {
    id: 'api:a',
    plan: proposed.meta.id,
    version: 'before',
  });
  expect(before?.flow?.handlers[0]?.nodes.find((node) => node.id === 'h:a#call')?.drill?.href).toBe(
    '/queries/entries/?id=api-supplier&plan=plan-drill&version=before',
  );
});
