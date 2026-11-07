import { beforeEach, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { NO_BASE } from '@/application/plan/plan-base';
import type { IndexedPlan } from '@/application/plans-index';
import type { ModelPlan } from '@/domain/workspace-model';

import { readModelPlanBaseMarkers } from './model-plan-base';
import { readModelPlanProgress, readSelectedPlanContext } from './model-plan-context';
import { modelPlanData } from './model-plan-data';
import { readModelPlanBaseInfo } from './model-plan-lock';
import { readModelPlanEntries, readModelPlanRevisions } from './model-plans';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./model-plan-context'), () => ({
  readSelectedPlanContext: vi.fn<typeof readSelectedPlanContext>(),
  readModelPlanProgress: vi.fn<typeof readModelPlanProgress>(),
}));
vi.mock(import('./model-plan-base'), () => ({
  readModelPlanBaseMarkers: vi.fn<typeof readModelPlanBaseMarkers>(),
}));
vi.mock(import('./model-plan-lock'), () => ({
  readModelPlanBaseInfo: vi.fn<typeof readModelPlanBaseInfo>(),
}));
vi.mock(import('./model-plans'), () => ({
  readModelPlanEntries: vi.fn<typeof readModelPlanEntries>(),
  readModelPlanRevisions: vi.fn<typeof readModelPlanRevisions>(),
}));
const plan: ModelPlan = {
  meta: { id: 'plan:stable-id', title: 'Actual plan' },
  problem: { summary: 'A known source' },
  changes: [],
};
function projection(): IndexedPlan {
  const model = { ...queryModel(), name: 'The canonical workspace name' };
  const index = indexOf(model);
  return {
    plan,
    before: model,
    after: model,
    beforeIndex: index,
    afterIndex: index,
    proposals: [],
  };
}
beforeEach(() => {
  vi.mocked(readModelPlanBaseInfo).mockResolvedValue({
    ...NO_BASE,
    mode: 'live',
    previousCheckedOn: '2026-10-16',
  });
  vi.mocked(readModelPlanBaseMarkers).mockResolvedValue(new Map());
  vi.mocked(readSelectedPlanContext).mockResolvedValue(projection());
  vi.mocked(readModelPlanEntries).mockResolvedValue([{ slug: 'actual-folder', plan }]);
  vi.mocked(readModelPlanRevisions).mockResolvedValue([{ version: '2.0', plan }]);
  vi.mocked(readModelPlanProgress).mockResolvedValue({
    progress: {
      events: [{ at: '2026-11-07', subject: 'wi:known', kind: 'note', note: 'The recorded note.' }],
    },
    errors: [{ path: 'progress.yaml', message: 'An explicit read problem.' }],
  });
  vi.clearAllMocks();
});
it('uses canonical context names and actual folder slugs while preserving independent progress metadata', async () => {
  const result = await modelPlanData({ workspace: 'queries', slug: 'actual-folder' });
  expect(result?.basis?.base.previousCheckedOn).toBe('2026-10-16');
  expect(readModelPlanBaseInfo).toHaveBeenCalledWith('queries', 'actual-folder');
  expect(result?.workspaceName).toBe('The canonical workspace name');
  expect(result?.outline.slug).toBe('actual-folder');
  expect(result?.plans[0]?.href).toBe('/queries/plans/actual-folder/');
  expect(readSelectedPlanContext).toHaveBeenCalledWith('queries', 'actual-folder');
  expect(readModelPlanProgress).toHaveBeenCalledWith('queries', 'actual-folder');
  expect(result?.progress.events[0]).toMatchObject({ note: 'The recorded note.' });
  expect(result?.context.progress).toBe(result?.progress);
  expect(result?.progress.errors).toEqual([
    { path: 'progress.yaml', message: 'An explicit read problem.' },
  ]);
  expect(readModelPlanRevisions).not.toHaveBeenCalled();
});
it('loads actual snapshot filenames only for a requested versions view', async () => {
  const result = await modelPlanData({ workspace: 'queries', slug: 'actual-folder' }, true);
  expect(result?.snapshots).toEqual([{ version: '2.0', plan }]);
  expect(readModelPlanRevisions).toHaveBeenCalledWith('queries', 'actual-folder');
});
it('does not load plan metadata when there is no selected canonical projection', async () => {
  vi.mocked(readSelectedPlanContext).mockResolvedValue(null);
  await expect(modelPlanData({ workspace: 'queries', slug: 'missing' })).resolves.toBeNull();
  expect(readModelPlanProgress).not.toHaveBeenCalled();
});

it('retains explicit proposed ancestor titles and actual folder links without composing another fact model', async () => {
  const ancestor: ModelPlan = {
    meta: { id: 'plan:ancestor-id', title: 'Actual ancestor' },
    problem: { summary: 'A proposal' },
    changes: [],
  };
  const selected = { ...projection(), plan: { ...plan, builds_on: ['plan:ancestor-id'] } };
  vi.mocked(readSelectedPlanContext).mockResolvedValue(selected);
  vi.mocked(readModelPlanEntries).mockResolvedValue([
    { slug: 'actual-folder', plan: selected.plan },
    { slug: 'different-folder', plan: ancestor },
  ]);
  const result = await modelPlanData({ workspace: 'queries', slug: 'actual-folder' });
  expect(result?.basis?.readsAfter).toEqual([
    {
      id: 'plan:ancestor-id',
      title: 'Actual ancestor',
      href: '/queries/plans/different-folder/',
      stage: 'Draft',
    },
  ]);
});
