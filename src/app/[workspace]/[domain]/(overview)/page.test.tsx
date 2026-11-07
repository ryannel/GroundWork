// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';
import { todayData } from '@/infrastructure/today-data';

import DomainInterfacesRoute from './interfaces/page';
import DomainLayout, { generateMetadata } from './layout';
import DomainMapRoute from './map/page';
import DomainRoute from './page';

vi.mock(import('next/navigation'), () => ({
  usePathname: () => '/queries/queries/',
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
vi.mock(import('@/infrastructure/today-data'), () => ({ todayData: vi.fn<typeof todayData>() }));
vi.mock(import('@/features/plan'), async (original) => {
  const planExports = await original();
  return {
    ...planExports,
    TodayOverlays: () => <span hidden />,
    ModelTodayOverlays: () => <span hidden />,
    TodaySearch: () => <span hidden />,
  };
});
vi.mock(import('server-only'), () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(queryModel()));
  vi.mocked(readModelPlans).mockResolvedValue([]);
});
afterEach(cleanup);
const params = Promise.resolve({ workspace: 'queries', domain: 'queries' });

describe('native domain routes', () => {
  it('names the domain and renders its existing shell with native navigation and plan locations', async () => {
    await expect(generateMetadata({ params })).resolves.toEqual({
      title: { default: 'Queries', template: '%s · Queries' },
    });
    render(await DomainLayout({ params, children: <p>Selected domain page</p> }));
    expect(screen.getByText('Selected domain page')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Interfaces/u }).getAttribute('href')).toMatch(
      /^\/queries\/queries\/interfaces\/?$/u,
    );
    expect(screen.getByRole('link', { name: 'A' }).getAttribute('href')).toMatch(
      /^\/queries\/queries\/a\/?$/u,
    );
    expect(todayData).not.toHaveBeenCalled();
  });

  it('renders the native overview with the visible implementation gap', async () => {
    render(await DomainRoute({ params }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Queries');
    expect(screen.getByText('Implementation not mapped.')).toBeTruthy();
    expect(screen.getByText('What remains unknown')).toBeTruthy();
    expect(todayData).not.toHaveBeenCalled();
  });

  it.each(['sys:b', 'b'])('selects native interface rows for system=%s', async (system) => {
    render(await DomainInterfacesRoute({ params, searchParams: Promise.resolve({ system }) }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Interfaces');
    expect(screen.getByText('Kept by A')).toBeTruthy();
    expect(screen.queryByText('From A')).toBeNull();
    expect(todayData).not.toHaveBeenCalled();
  });

  it('draws the native scoped map and rejects a domain that is not declared', async () => {
    render(await DomainMapRoute({ params }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Map');
    expect(screen.getAllByText('Implementation not mapped').length).toBeGreaterThan(0);
    expect(todayData).not.toHaveBeenCalled();
    await expect(
      DomainRoute({ params: Promise.resolve({ workspace: 'queries', domain: 'missing' }) }),
    ).rejects.toThrow('Not found');
  });
});
