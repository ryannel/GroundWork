import { describe, expect, it, vi } from 'vitest';

import { fingerprintOf, scopeOf, type PlanBase } from '@/application/plan/plan-base';
import { modelProblems } from '@/infrastructure/model-schema';

vi.mock(import('server-only'), () => ({}));
const story = {
  chapters: {
    today: { headline: 'Read and show the order', recap: ['The original chapter remains.'] },
  },
  summary: 'The original authored explanation.',
  scope: ['svc:scope'],
  concepts: ['con:order'],
  stages: [
    {
      id: 'stage:read',
      name: 'Read',
      summary: 'Read the order',
      components: [{ component: 'svc:reader', from: ['api:read-order'] }],
      flows: ['flow:read-order'],
    },
    {
      id: 'stage:show',
      name: 'Show',
      summary: 'Show the order',
      components: [{ component: 'app:shop' }],
    },
  ],
};
describe('reference-only plan story metadata', () => {
  it('retains chapters, authored prose, concept references and local stage identities', async () => {
    const plan = {
      meta: { id: 'plan:story', title: 'Explain the order' },
      problem: { summary: 'Keep the complete authored story.' },
      changes: [],
      story,
    };
    await expect(modelProblems('plan', 'document', plan)).resolves.toEqual([]);
  });
  it.each([
    { value: { ...story, scope: ['not-an-id'] }, path: '/scope/0' },
    { value: { ...story, concepts: [{ id: 'con:order', name: 'Order' }] }, path: '/concepts/0' },
    { value: { ...story, concepts: ['svc:reader'] }, path: '/concepts/0' },
    { value: { ...story, stages: [story.stages[0], story.stages[0]] }, path: '/stages' },
    {
      value: { ...story, stages: [{ ...story.stages[0], id: 'svc:reader' }] },
      path: '/stages/0/id',
    },
    {
      value: {
        ...story,
        stages: [{ ...story.stages[0], steps: [{ id: 'copied', does: 'A copied fact' }] }],
      },
      path: '/stages/0',
    },
    {
      value: {
        ...story,
        stages: [
          { ...story.stages[0], components: [{ component: 'svc:reader', from: ['not-an-id'] }] },
        ],
      },
      path: '/stages/0/components/0/from/0',
    },
  ])('rejects malformed or copied story data at $path', async ({ value, path }) => {
    const problems = await modelProblems('plan', 'story', value);
    expect(problems).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  });
  it('keeps nested component, focus and flow references in the existing generic scope walk', () => {
    const base: PlanBase = {
      mode: 'live',
      landedOn: null,
      collections: {
        services: [
          { id: 'svc:scope' },
          { id: 'svc:reader' },
          { id: 'app:shop' },
          { id: 'svc:far' },
        ],
        interfaces: [{ id: 'if:reader', endpoints: [{ id: 'api:read-order' }] }],
        flows: [{ id: 'flow:read-order' }],
      },
    };
    expect(scopeOf(base, [{ story }])).toEqual(
      new Set(['svc:scope', 'svc:reader', 'if:reader', 'flow:read-order', 'app:shop']),
    );
  });
  it('changes the checked plan hash when context or stage identity changes', () => {
    const original = { story };
    expect(fingerprintOf({ story: { ...story, scope: ['svc:another'] } })).not.toBe(
      fingerprintOf(original),
    );
    expect(
      fingerprintOf({ story: { ...story, stages: [{ ...story.stages[0], id: 'stage:another' }] } }),
    ).not.toBe(fingerprintOf(original));
  });
});
