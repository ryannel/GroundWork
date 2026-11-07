import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan } from '@/domain/workspace-model';

import { indexOf } from './model-index';
import { modelStandingOf, modelStandingScopes } from './model-plan-standing';

it('reads native readonly metadata, commitments, work, dates and explicit cross-plan blockers without a legacy Plan', () => {
  const plan: ModelPlan = {
    meta: { id: 'plan:work', title: 'Native work' },
    problem: { summary: 'Synthetic standing' },
    changes: [],
    work_items: [
      {
        id: 'wi:task',
        title: 'The exact task',
        team: 'team:a',
        milestone: 'ms:delivery',
        needed_by: '2026-11-10',
        depends_on: ['foundation/wi:base'],
        blocked_by: ['q:local', 'delivery/q:external'],
      },
    ],
    milestones: [{ id: 'ms:delivery', name: 'Delivery', due: '2026-11-11' }],
    questions: [{ id: 'q:local', question: 'Who decides?', status: 'open' }],
  };
  const foundation: ModelPlan = {
    meta: { id: 'plan:different-meta-id', title: 'Foundation' },
    problem: { summary: 'An explicit neighbour' },
    changes: [],
    work_items: [{ id: 'wi:base', title: 'Known prerequisite', team: 'team:b' }],
  };
  const source = queryModel();
  const model = {
    ...source,
    programmes: [
      {
        id: 'prog:delivery',
        title: 'Delivery programme',
        outcome: 'Known outcome',
        questions: [{ id: 'q:external', question: 'Programme decision?', status: 'open' as const }],
      },
    ],
  };
  const progress = {
    events: [
      {
        subject: 'wi:task',
        kind: 'commitment' as const,
        state: 'accepted' as const,
        at: '2026-11-07',
        promised_for: '2026-11-13',
        confidence: 'medium' as const,
        said_by: 'The named team',
      },
      {
        subject: 'wi:task',
        kind: 'work' as const,
        state: 'blocked' as const,
        at: '2026-11-08',
        note: 'The recorded blocker.',
      },
    ],
  };
  const standing = modelStandingOf(plan, progress, indexOf(model), [
    {
      scope: 'foundation',
      plan: foundation,
      progress: {
        events: [{ subject: 'wi:base', kind: 'commitment', state: 'declined', at: '2026-11-06' }],
      },
    },
  ]);
  expect(modelStandingScopes(plan)).toEqual(['foundation', 'delivery']);
  expect(standing.work[0]?.team).toEqual({ id: 'team:a', name: 'A', partner: false });
  expect(standing.work[0]?.commitment).toMatchObject({
    state: 'accepted',
    promisedFor: '2026-11-13',
    confidence: 'medium',
    saidBy: 'The named team',
  });
  expect(standing.work[0]?.dates).toEqual({
    neededBy: '2026-11-10',
    promisedFor: '2026-11-13',
    gapDays: 3,
  });
  expect(standing.work[0]?.progress?.state).toBe('blocked');
  expect(standing.work[0]?.blockers).toEqual(
    expect.arrayContaining([
      {
        kind: 'depends-on',
        id: 'foundation/wi:base',
        label: 'Known prerequisite',
        state: 'declined',
      },
      { kind: 'question', id: 'q:local', label: 'Who decides?', state: 'open' },
      { kind: 'question', id: 'delivery/q:external', label: 'Programme decision?', state: 'open' },
    ]),
  );
  expect(standing.milestones[0]?.lastHeard?.at).toBe('2026-11-08');
});
it('resolves a programme question only through its recorded accepted decision', () => {
  const plan: ModelPlan = {
    meta: { id: 'plan:p', title: 'Native gate' },
    problem: { summary: 'Synthetic gate' },
    changes: [],
    work_items: [
      { id: 'wi:task', title: 'Task', team: 'team:a', blocked_by: ['delivery/q:external'] },
    ],
  };
  const source = queryModel();
  const model = {
    ...source,
    programmes: [
      {
        id: 'prog:delivery',
        title: 'Programme',
        outcome: 'Outcome',
        questions: [
          {
            id: 'q:external',
            question: 'The recorded question',
            status: 'open' as const,
            answered_by: 'dec:answer',
          },
        ],
        decisions: [
          { id: 'dec:answer', title: 'The recorded answer', status: 'accepted' as const },
        ],
      },
    ],
  };
  expect(modelStandingOf(plan, { events: [] }, indexOf(model)).work[0]?.blockers).toEqual([]);
});
