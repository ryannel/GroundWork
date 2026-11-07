import { expect, it } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan } from '@/domain/workspace-model';

import { modelContextOf, selectedPlanPayload, type ModelPlanPayload } from './model-reader';
import { selectedPlanProjection } from './plans-index';

const plan: ModelPlan = {
  meta: { id: 'plan:reader', title: 'Explain the proposed request' },
  problem: { summary: 'Prove that the browser receives the server projection.' },
  story: { summary: 'Keep the explanation', scope: ['api:a'] },
  changes: [
    {
      id: 'chg:condition',
      title: 'Qualify the outgoing request',
      ops: [modelOp({ modify: 'h:a#call', set: { when: 'The recorded approval is present' } })],
    },
  ],
};

it('shares one query index for the current model on both sides', () => {
  const model = queryModel();
  const context = modelContextOf({ model });
  expect(context.plan).toBeNull();
  expect(context.beforeIndex).toBe(context.afterIndex);
  expect(context.beforeIndex.model).toBe(model);
  expect(context.afterIndex.get('h:a#call')?.data.call).toBe('api:supplier');
});

it('reuses an identical supplied before/after model without replaying the plan', () => {
  const model = queryModel();
  const context = modelContextOf({ plan, before: model, after: model });
  expect(context.plan).toBe(plan);
  expect(context.beforeIndex).toBe(context.afterIndex);
  expect(context.afterIndex.get('h:a#call')?.data.when).toBeUndefined();
});

it('reconstructs server query facts from JSON while preserving narrative, citations and proposal gaps', () => {
  const server = selectedPlanProjection(plan, [plan], queryModel());
  const payload = selectedPlanPayload(server);
  const json = JSON.stringify(payload);
  const transported = JSON.parse(json) as ModelPlanPayload;
  const browser = modelContextOf(transported);
  expect(browser.plan).toEqual(server.plan);
  expect(browser.plan?.story).toEqual(plan.story);
  expect(browser.beforeIndex.get('h:a#call')).toEqual(server.beforeIndex.get('h:a#call'));
  expect(browser.afterIndex.get('h:a#call')).toEqual(server.afterIndex.get('h:a#call'));
  expect(browser.beforeIndex.get('h:a#call')?.data.when).toBeUndefined();
  expect(browser.afterIndex.get('h:a#call')?.data.when).toBe('The recorded approval is present');
  expect(browser.afterIndex.cites('h:a#call')).toEqual(server.afterIndex.cites('h:a#call'));
  expect(browser.afterIndex.gaps('h:a#call')).toEqual(server.afterIndex.gaps('h:a#call'));
  expect(browser.afterIndex.gaps('h:a#call')).toContainEqual(
    expect.objectContaining({
      id: 'h:a#call',
      kind: 'proposed_effect',
    }),
  );
});
