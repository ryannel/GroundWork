// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';

import WorkspaceRoute from './page';

vi.mock(import('next/navigation'), () => ({
  usePathname: () => '/queries/',
  notFound: () => {
    throw new Error('Not found');
  },
}));
vi.mock(import('@/infrastructure/model-index'), () => ({
  readCanonicalModelIndex: vi.fn<typeof readCanonicalModelIndex>(),
}));
vi.mock(import('@/infrastructure/model-plans'), () => ({
  readModelPlans: vi.fn<typeof readModelPlans>(),
}));
vi.mock(import('@/features/plan'), () => ({
  TodayOverlays: () => <span hidden />,
  ModelTodayOverlays: () => <span hidden />,
  TodaySearch: () => <span hidden />,
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readModelPlans).mockResolvedValue([]);
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(null);
});
afterEach(cleanup);
const params = Promise.resolve({ workspace: 'queries' });

describe('workspace overview route', () => {
  it('renders the native domain map without a legacy read or entry-flow redirect', async () => {
    vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(queryModel()));
    render(await WorkspaceRoute({ params }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Query fixture');
    expect(screen.getByRole('img', { name: /customer, the domains and the people/u })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Entry flows/u }).getAttribute('href')).toBe(
      '/queries/entries',
    );
    expect(readCanonicalModelIndex).toHaveBeenCalledTimes(1);
  });

  it('renders the native authored areas directly with existing bare area paths', async () => {
    const model = {
      ...queryModel(),
      landscape: {
        label: 'Inferred' as const,
        scope: 'Known fixture scope',
        limitation: 'Fixture interpretation',
        areas: [{ id: 'area:work', name: 'Doing work', purpose: 'Complete a known task' }],
      },
    };
    vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(model));
    render(await WorkspaceRoute({ params }));
    expect(screen.getByRole('heading', { name: 'How the company works' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Doing work/u }).getAttribute('href')).toBe(
      '/queries/areas/work',
    );
    expect(screen.getByText('Fixture interpretation')).toBeTruthy();
  });

  it('does not reconstruct a format-1 workspace on the native route', async () => {
    await expect(WorkspaceRoute({ params })).rejects.toThrow('Not found');

    expect(readModelPlans).not.toHaveBeenCalled();
  });

  it('keeps a missing workspace as not found', async () => {
    await expect(WorkspaceRoute({ params })).rejects.toThrow('Not found');
    expect(readModelPlans).not.toHaveBeenCalled();
  });
});
