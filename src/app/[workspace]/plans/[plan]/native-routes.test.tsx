// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { modelPlanOutline } from '@/application/model-plan-pages';
import { modelContextOf } from '@/application/model-reader';
import type { Outline } from '@/application/plan-navigation';
import type { ModelPlan } from '@/domain/workspace-model';
import { modelPlanData, type ModelPlanData } from '@/infrastructure/model-plan-data';

import ChapterRoute, { generateMetadata as chapterMetadata } from './[chapter]/[screen]/page';
import CoverRoute, { generateMetadata as coverMetadata } from './page';
import ThingRoute from './things/page';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/infrastructure/model-plan-data'), () => ({
  modelPlanData: vi.fn<typeof modelPlanData>(),
}));
vi.mock(import('@/features/plan'), () => ({
  ModelPlanPage: ({ outline }: { readonly outline: Outline }) => (
    <div>Native page: {outline.title}</div>
  ),
  ModelPlanThingPage: ({ token }: { readonly token: string }) => <div>Native thing: {token}</div>,
}));
const plan: ModelPlan = {
  meta: { id: 'plan:native', title: 'Actual native route' },
  problem: { summary: 'The original source' },
  changes: [],
};
function data(): ModelPlanData {
  const model = queryModel();
  const context = modelContextOf({ plan, before: model, after: model });
  return {
    context,
    outline: modelPlanOutline(context, { workspace: 'queries', slug: 'native' }),
    workspaceName: 'Queries',
    plans: [],
    progress: { events: [], errors: [], status: {} },
    snapshots: [],
    basis: null,
  };
}
beforeEach(() => {
  vi.mocked(modelPlanData).mockResolvedValue(data());
});
afterEach(cleanup);
const params = Promise.resolve({ workspace: 'queries', plan: 'native' });
it('uses native data for the cover and its metadata from the selected projection', async () => {
  await expect(coverMetadata({ params })).resolves.toEqual({ title: 'Actual native route' });
  render(await CoverRoute({ params, searchParams: Promise.resolve({ team: 'team:a' }) }));
  expect(screen.getByText('Native page: Actual native route')).toBeTruthy();
});
it('opens a native chapter and loads revision snapshots only for the versions chapter', async () => {
  const at = Promise.resolve({
    workspace: 'queries',
    plan: 'native',
    chapter: 'why',
    screen: 'problem',
  });
  await expect(chapterMetadata({ params: at })).resolves.toEqual({
    title: 'The problem · Actual native route',
  });
  render(await ChapterRoute({ params: at, searchParams: Promise.resolve({ view: 'before' }) }));
  expect(screen.getByText('Native page: Actual native route')).toBeTruthy();
  expect(modelPlanData).toHaveBeenLastCalledWith({ workspace: 'queries', slug: 'native' }, false);
});
it('opens a native thing with the exact requested token', async () => {
  render(
    await ThingRoute({ params, searchParams: Promise.resolve({ id: 'api-a', view: 'before' }) }),
  );
  expect(screen.getByText('Native thing: api-a')).toBeTruthy();
});
it('keeps native missing plans and unknown chapter screens as not-found as explicit missing addresses', async () => {
  vi.mocked(modelPlanData).mockResolvedValue(null);
  await expect(CoverRoute({ params, searchParams: Promise.resolve({}) })).rejects.toThrow(/404/u);
  vi.mocked(modelPlanData).mockResolvedValue(data());
  await expect(
    ChapterRoute({
      params: Promise.resolve({
        workspace: 'queries',
        plan: 'native',
        chapter: 'why',
        screen: 'unknown',
      }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow(/404/u);
});
