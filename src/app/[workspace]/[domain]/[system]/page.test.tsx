// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flowFixture } from '@/../test/fixtures/model-current-flow';
import { queryModel, systemProviderModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { ModelPlan } from '@/domain/workspace-model';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanProgress } from '@/infrastructure/model-plan-context';
import { readModelPlanEntries } from '@/infrastructure/model-plans';

import SystemFlowRoute, { generateMetadata as flowMetadata } from './flows/[flow]/page';
import SystemLayout, { generateMetadata } from './layout';
import SystemRoute from './page';

vi.mock(import('next/navigation'), () => ({
  usePathname: () => '/queries/queries/a/',
  notFound: () => {
    throw new Error('Not found');
  },
}));
vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/infrastructure/model-index'), () => ({
  readCanonicalModelIndex: vi.fn<typeof readCanonicalModelIndex>(),
}));
vi.mock(import('@/infrastructure/model-plan-context'), () => ({
  readModelPlanProgress: vi.fn<typeof readModelPlanProgress>(),
}));
vi.mock(import('@/infrastructure/model-plans'), () => ({
  readModelPlanEntries: vi.fn<typeof readModelPlanEntries>(),
}));
vi.mock(import('@/features/plan'), async (original) => ({
  ...(await original()),
  ModelTodayOverlays: () => <span hidden />,
  TodaySearch: () => <span hidden />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(queryModel()));
  vi.mocked(readModelPlanEntries).mockResolvedValue([]);
  vi.mocked(readModelPlanProgress).mockResolvedValue({ progress: { events: [] }, errors: [] });
});
afterEach(cleanup);
const params = Promise.resolve({ workspace: 'queries', domain: 'queries', system: 'a' });

function workPlan(id: string, repo: string): ModelPlan {
  return {
    meta: { id, title: id },
    problem: { summary: 'A current proposal' },
    changes: [{ id: 'chg:one', title: 'Work' }],
    work_items: [{ id: 'wi:one', title: 'Assigned work', team: 'team:a', repo }],
  };
}

describe('native system routes', () => {
  it('renders the native system overview and no-flow teaching without legacy or explorer reads', async () => {
    await expect(generateMetadata({ params })).resolves.toEqual({
      title: { default: 'A', template: '%s · A' },
    });
    render(await SystemLayout({ params, children: await SystemRoute({ params }) }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('A');
    expect(screen.getByText('No authored flow recorded')).toBeTruthy();
    expect(screen.getByText('Recorded entries')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'GET /a' }).length).toBeGreaterThan(0);
  });

  it('selects only an actual authored flow and keeps its exact wording', async () => {
    vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(flowFixture()));
    render(await SystemRoute({ params }));
    expect(screen.getByText('A precise trigger')).toBeTruthy();
    expect(screen.getByText('A precise outcome')).toBeTruthy();
    cleanup();
    const flowParams = Promise.resolve({
      workspace: 'queries',
      domain: 'queries',
      system: 'a',
      flow: 'story',
    });
    await expect(flowMetadata({ params: flowParams })).resolves.toEqual({
      title: 'An authored narrative',
    });
    render(await SystemFlowRoute({ params: flowParams }));
    expect(screen.getByText('Never reports success after failure')).toBeTruthy();
    await expect(
      SystemFlowRoute({
        params: Promise.resolve({
          workspace: 'queries',
          domain: 'queries',
          system: 'a',
          flow: 'not-a-flow',
        }),
      }),
    ).rejects.toThrow('Not found');
  });

  it('shows a declared unmapped provider and its API without inventing a component or operator', async () => {
    vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(systemProviderModel()));
    const unknown = Promise.resolve({
      workspace: 'queries',
      domain: 'queries',
      system: 'unmapped',
    });
    render(
      await SystemLayout({ params: unknown, children: await SystemRoute({ params: unknown }) }),
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Unmapped');
    expect(screen.getByText('Team not recorded')).toBeTruthy();
    expect(screen.getAllByText(/Implementation not mapped/u).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'GET /known' }).getAttribute('href')).toMatch(
      /^\/queries\/entries\/?\?id=api-unmapped-api$/u,
    );
    expect(screen.getByText('0 components')).toBeTruthy();
  });

  it('loads progress only for structurally touching plans and keeps missing progress explicit', async () => {
    vi.mocked(readModelPlanEntries).mockResolvedValue([
      { slug: 'actual-folder', plan: workPlan('plan:touching', 'fixture/a') },
      { slug: 'other-folder', plan: workPlan('plan:other', 'fixture/b') },
    ]);
    render(await SystemLayout({ params, children: <p>System content</p> }));
    expect(screen.getByRole('link', { name: 'plan:touching' }).getAttribute('href')).toMatch(
      /^\/queries\/plans\/actual-folder\/?$/u,
    );
    expect(screen.queryByRole('link', { name: 'plan:other' })).toBeNull();
    expect(screen.getByText('No work progress recorded for 1 assigned item.')).toBeTruthy();
    expect(readModelPlanProgress).toHaveBeenCalledTimes(1);
    expect(readModelPlanProgress).toHaveBeenCalledWith('queries', 'actual-folder');
  });

  it('rejects undeclared native systems and noncanonical workspaces without a legacy reader', async () => {
    await expect(
      SystemRoute({
        params: Promise.resolve({ workspace: 'queries', domain: 'queries', system: 'missing' }),
      }),
    ).rejects.toThrow('Not found');
    vi.mocked(readCanonicalModelIndex).mockResolvedValue(null);
    const absent = Promise.resolve({ workspace: 'acme', domain: 'orders', system: 'ordering' });
    await expect(SystemLayout({ params: absent, children: <p>System content</p> })).rejects.toThrow(
      'Not found',
    );
    await expect(SystemRoute({ params: absent })).rejects.toThrow('Not found');
    await expect(
      SystemFlowRoute({
        params: Promise.resolve({
          workspace: 'acme',
          domain: 'orders',
          system: 'ordering',
          flow: 'place-order',
        }),
      }),
    ).rejects.toThrow('Not found');
    await expect(generateMetadata({ params: absent })).resolves.toEqual({});
  });
});
