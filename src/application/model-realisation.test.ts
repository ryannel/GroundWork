import { expect, it } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelOp } from '@/domain/plan-apply';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { indexOf } from './model-index';
import { modelRealisationOf } from './model-realisation';

function plan(ops: readonly ModelOp[]): ModelPlan {
  return {
    meta: { id: 'plan:comparison', title: 'Compare recorded model facts' },
    problem: { summary: 'Synthetic comparison' },
    changes: [{ id: 'chg:comparison', title: 'Compare the requested facts', ops }],
  };
}
const result = (value: unknown, model: WorkspaceModel = queryModel()) =>
  modelRealisationOf(plan([modelOp(value)]), indexOf(model))[0];
it('compares requested facts against the current index, not a plan after-model', () => {
  expect(result({ modify: 'api:a', set: { method: 'GET', path: '/a' } })?.state).toBe('matches');
  expect(result({ modify: 'api:a', set: { method: 'GET', path: '/different' } })?.state).toBe(
    'partial',
  );
  expect(result({ modify: 'api:missing', set: { method: 'GET' } })?.ops[0]).toMatchObject({
    state: 'missing',
    target: 'api:missing',
  });
});
it('checks appended and dropped values without requiring unrelated facts to change', () => {
  expect(result({ modify: 'svc:a', append: { homes: ['a'] } })?.state).toBe('matches');
  expect(result({ modify: 'svc:a', append: { homes: ['not-recorded'] } })?.state).toBe('missing');
  expect(result({ modify: 'svc:a', drop: { homes: ['not-recorded'] } })?.state).toBe('matches');
  expect(result({ modify: 'svc:a', drop: { homes: ['a'] } })?.state).toBe('missing');
});
it('retains nested field identity when checking additions and reports contradictory recorded fields', () => {
  expect(
    result({ add: 'field', into: 'sch:remote', value: { id: 'id', name: 'id', type: 'string' } })
      ?.state,
  ).toBe('matches');
  expect(
    result({ add: 'field', into: 'sch:remote', value: { id: 'id', name: 'id', type: 'int' } })
      ?.state,
  ).toBe('differs');
});
it('distinguishes an absent property from a requested null value and ignores object key representation', () => {
  expect(result({ modify: 'sch:remote#id', set: { default: null } })?.state).toBe('missing');
  expect(
    result({ modify: 'if:a', set: { entries: [{ path: '/a', method: 'GET', id: 'api:a' }] } })
      ?.state,
  ).toBe('matches');
});
it('does not assert citation representation is a changed or implemented business fact', () => {
  const original = queryModel();
  const compared = result(
    { modify: 'h:a#call', set: { call: 'api:supplier', cites: ['fixture:example.ts#L1-2'] } },
    original,
  );
  expect(compared?.state).toBe('unverified');
  expect(compared?.ops[0]?.detail).toContain('1 of 2 requested facts agree');
  expect(compared?.ops[0]?.detail).toContain('1 citation comparisons remain unverified');
  expect(original.domains[0]?.systems[0]?.handlers[0]?.steps[3]?.cites).toEqual(
    queryModel().domains[0]?.systems[0]?.handlers[0]?.steps[3]?.cites,
  );
});
it('refuses proposed facts as proof of current realisation and keeps an empty intent unverified', () => {
  const source = queryModel();
  const proposed: WorkspaceModel = {
    ...source,
    problems: [{ id: 'h:a#call', kind: 'proposed_effect', message: 'Synthetic proposed effect' }],
  };
  expect(result({ modify: 'h:a#call', set: { call: 'api:supplier' } }, proposed)?.state).toBe(
    'unverified',
  );
  expect(modelRealisationOf(plan([]), indexOf(source))[0]?.state).toBe('unverified');
});
it('describes removal as model absence without claiming a deployed deletion', () => {
  expect(result({ remove: 'job:missing' })?.state).toBe('matches');
  expect(result({ remove: 'job:missing' })?.ops[0]?.detail).toContain(
    'does not establish deployed removal',
  );
  expect(result({ deprecate: 'api:a' })?.state).toBe('missing');
});
