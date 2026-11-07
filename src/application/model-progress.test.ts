import { expect, it } from 'vitest';

import { modelPlanProgressOf, modelProgressRecords } from './model-progress';

it('retains recorded progress, notes and read errors without guessing missing issue state', () => {
  const read = {
    progress: {
      events: [
        {
          at: '2026-11-07',
          subject: 'wi:one',
          kind: 'work' as const,
          state: 'done' as const,
          source: { kind: 'github' as const, repo: 'fixture/a', issue: 3 },
          note: 'Recorded by the sync.',
        },
        {
          at: '2026-11-07',
          subject: 'wi:two',
          kind: 'note' as const,
          note: 'Waiting for a person.',
        },
      ],
    },
    errors: [{ path: 'progress.yaml', message: 'A separate recorded warning.' }],
  };
  const progress = modelPlanProgressOf(read);
  expect(progress.events).toBe(read.progress.events);
  expect(progress.errors).toBe(read.errors);
  expect(progress.status['wi:one']).toMatchObject({ state: 'closed', closed_at: '2026-11-07' });
  expect(progress.status['wi:two']).toBeUndefined();
  expect(modelProgressRecords(progress, 'wi:two')[0]).toMatchObject({
    state: null,
    note: 'Waiting for a person.',
  });
  expect(modelProgressRecords(progress)[0]?.source).toBe('https://github.com/fixture/a/issues/3');
});
