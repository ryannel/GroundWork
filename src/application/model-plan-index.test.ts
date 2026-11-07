import { expect, it } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan } from '@/domain/workspace-model';

import { indexOf } from './model-index';
import { modelPlanRowsOf } from './model-plan-index';
import { modelPlanProgressOf } from './model-progress';

it('keeps actual folder links, structural footprint, checked state and unknown progress without composing plans', () => {
  const plan: ModelPlan = {
    meta: { id: 'plan:stable', title: 'Native list', status: 'review', date: '2026-11-07' },
    problem: { summary: 'Explain [[api:a]].' },
    changes: [
      {
        id: 'chg:condition',
        title: 'Condition',
        ops: [modelOp({ modify: 'h:a#call', set: { when: 'Approved' } })],
      },
    ],
    work_items: [
      { id: 'wi:one', title: 'First', team: 'team:a' },
      { id: 'wi:two', title: 'Second', team: 'team:a' },
    ],
  };
  const progress = modelPlanProgressOf({
    progress: {
      events: [
        {
          subject: 'wi:one',
          kind: 'work',
          state: 'done',
          at: '2026-11-07',
          source: { kind: 'github', repo: 'fixture/a', issue: 1 },
        },
        { subject: 'wi:two', kind: 'note', at: '2026-11-07', note: 'Still undecided.' },
      ],
    },
    errors: [{ path: 'progress.yaml', message: 'A recorded warning.' }],
  });
  const result = modelPlanRowsOf(indexOf(queryModel()), [
    { slug: 'real-folder', plan, progress, base: { mode: 'live', checkedOn: null, edited: false } },
  ]);
  expect(result.rows[0]).toMatchObject({
    href: '/queries/plans/real-folder/',
    domains: ['dom:queries'],
    workItems: 2,
    done: 1,
    progressUnknown: 1,
    stage: 'delivery',
    check: 'never',
  });
  expect(result.gaps).toContainEqual({
    id: 'plan:stable',
    kind: 'progress_read_error',
    message: 'progress.yaml: A recorded warning.',
  });
  const noEvents = modelPlanProgressOf({ progress: { events: [] }, errors: [] });
  expect(
    modelPlanRowsOf(indexOf(queryModel()), [
      {
        slug: 'real-folder',
        plan,
        progress: noEvents,
        base: { mode: 'landed', checkedOn: null, edited: false },
      },
    ]).rows[0],
  ).toMatchObject({ done: 0, progressUnknown: 2, stage: 'review', check: null });
});
