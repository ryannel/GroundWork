import { describe, expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { indexOf } from './model-index';
import { planStoryProblems } from './plan-story';

const plan = (story?: ModelPlan['story']): ModelPlan => ({
  meta: { id: 'plan:context', title: 'Keep the context' },
  problem: { summary: 'Retain the authored model references.' },
  changes: [],
  ...(story === undefined ? {} : { story }),
});
const current = (): WorkspaceModel => ({
  ...queryModel(),
  flows: [{ id: 'flow:context', name: 'Context', steps: [] }],
});
describe('canonical plan story references', () => {
  it('resolves model references in before or after and stage references within the containing plan', () => {
    const before = current();
    const after: WorkspaceModel = {
      ...before,
      domains: before.domains.map((domain) => ({
        ...domain,
        language: { concepts: [{ id: 'con:version', name: 'Version' }] },
      })),
    };
    const overlay = plan({
      scope: ['svc:a', 'h:a#read', 'stage:show'],
      concepts: ['con:version'],
      stages: [
        {
          id: 'stage:read',
          name: 'Read',
          summary: 'Read the item',
          components: [{ component: 'svc:a', from: ['api:a', 'stage:show'] }],
          flows: ['flow:context'],
        },
        {
          id: 'stage:show',
          name: 'Show',
          summary: 'Show the item',
          components: [{ component: 'svc:b' }],
        },
      ],
    });
    const snapshot = JSON.stringify([before, after, overlay]);
    expect(indexOf(before).get('con:version')).toBeNull();
    expect(planStoryProblems(overlay, indexOf(before), indexOf(after))).toEqual([]);
    expect(JSON.stringify([before, after, overlay])).toBe(snapshot);
  });
  it.each([
    { story: { scope: ['svc:missing'] }, path: 'scope/0', id: 'svc:missing' },
    { story: { concepts: ['con:missing'] }, path: 'concepts/0', id: 'con:missing' },
    { story: { scope: ['stage:missing'] }, path: 'scope/0', id: 'stage:missing' },
    {
      story: {
        stages: [
          {
            id: 'stage:read',
            name: 'Read',
            summary: 'Read',
            components: [{ component: 'svc:missing' }],
          },
        ],
      },
      path: 'stages/0/components/0/component',
      id: 'svc:missing',
    },
    {
      story: {
        stages: [
          {
            id: 'stage:read',
            name: 'Read',
            summary: 'Read',
            components: [{ component: 'svc:a', from: ['stage:missing'] }],
          },
        ],
      },
      path: 'stages/0/components/0/from/0',
      id: 'stage:missing',
    },
    {
      story: {
        stages: [
          {
            id: 'stage:read',
            name: 'Read',
            summary: 'Read',
            components: [],
            flows: ['flow:missing'],
          },
        ],
      },
      path: 'stages/0/flows/0',
      id: 'flow:missing',
    },
  ])('reports a missing reference at $path', ({ story, path, id }) => {
    const index = indexOf(current());
    expect(planStoryProblems(plan(story), index, index)).toEqual([
      { at: `plan:context/story/${path}`, message: `Unresolved plan story reference: ${id}.` },
    ]);
  });
  it('allows a plan with no authored story metadata', () => {
    const index = indexOf(current());
    expect(planStoryProblems(plan(), index, index)).toEqual([]);
  });
});
