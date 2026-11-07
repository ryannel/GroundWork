import { beforeAll, describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { ModelPlan } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { modelSystemPlanProgress, modelSystemPlansOf } from './model-system-plans';

vi.mock(import('server-only'), () => ({}));
let checkPlan: (value: unknown) => value is ModelPlan;
beforeAll(async () => {
  checkPlan = await modelValidator('plan', 'document');
});
function plan(ops: readonly unknown[], work: readonly unknown[] = []): ModelPlan {
  const value: unknown = {
    meta: { id: 'plan:one', title: 'A current proposal' },
    problem: { summary: 'A fixture change' },
    changes: [{ id: 'chg:one', title: 'Change', ops }],
    work_items: work,
  };
  if (!checkPlan(value)) throw new Error('Invalid synthetic plan');
  return value;
}

describe('native system plan links', () => {
  it('locates a changed resource in its containing system rather than its foreign owner', () => {
    const index = indexOf(queryModel());
    const entries = [
      {
        slug: 'actual-folder',
        plan: plan([{ modify: 'st:remote', set: { name: 'Revised store' } }]),
      },
    ];
    expect(modelSystemPlansOf(index, 'sys:a', entries).items).toEqual([]);
    expect(modelSystemPlansOf(index, 'sys:b', entries).items[0]).toMatchObject({
      title: 'A current proposal',
      href: '/queries/plans/actual-folder/',
      workIds: [],
      progress: 'Work progress has not been read.',
    });
  });

  it('scopes work by recorded repository homes and keeps absent progress visibly unknown', () => {
    const index = indexOf(queryModel());
    const proposed = plan(
      [],
      [
        { id: 'wi:first', title: 'First', team: 'team:b', repo: 'fixture/b' },
        { id: 'wi:second', title: 'Second', team: 'team:b', repo: 'fixture/b' },
      ],
    );
    const selected = modelSystemPlansOf(index, 'sys:b', [{ slug: 'work', plan: proposed }]);
    const item = selected.items[0];
    if (item === undefined) throw new Error('Missing native plan link');
    expect(item.workIds).toEqual(['wi:first', 'wi:second']);
    expect(modelSystemPlanProgress(item, null)).toBe(item);
    expect(modelSystemPlanProgress(item, { events: [] }).progress).toBe(
      'No work progress recorded for 2 assigned items.',
    );
    expect(
      modelSystemPlanProgress(item, {
        events: [{ kind: 'work', subject: 'wi:first', at: '2026-11-01', state: 'done' }],
      }).progress,
    ).toBe('1 of 2 assigned items recorded done; 1 item without a recorded work state.');
    expect(
      modelSystemPlanProgress(item, {
        events: [
          { kind: 'work', subject: 'wi:first', at: '2026-11-01', state: 'done' },
          { kind: 'work', subject: 'wi:first', at: '2026-11-02', state: 'in_progress' },
          { kind: 'work', subject: 'wi:second', at: '2026-11-03', state: 'blocked' },
        ],
      }).progress,
    ).toBe('0 of 2 assigned items recorded done.');
    expect(
      modelSystemPlanProgress(item, { events: [] }, [{ message: 'The progress file is invalid' }])
        .progress,
    ).toBe('Progress could not be read: The progress file is invalid');
  });
});
