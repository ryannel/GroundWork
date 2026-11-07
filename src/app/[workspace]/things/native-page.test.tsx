// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';
import { todayData } from '@/infrastructure/today-data';

import ThingRoute from './page';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/navigation'), () => ({
  usePathname: () => '/queries/things/',
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
vi.mock(import('@/features/plan'), async (load) => ({
  ...(await load()),
  ModelTodayOverlays: () => <span hidden />,
  TodaySearch: () => <span hidden />,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('renders current native identity, ownership, sources and detail without reconstructing the old model', async () => {
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(indexOf(queryModel()));
  vi.mocked(readModelPlans).mockResolvedValue([]);
  vi.mocked(todayData).mockRejectedValue(new Error('Legacy reader must not run'));
  render(
    await ThingRoute({
      params: Promise.resolve({ workspace: 'queries' }),
      searchParams: Promise.resolve({ id: 'svc-a' }),
    }),
  );
  expect(screen.getByRole('heading', { level: 1, name: 'A' })).toBeTruthy();
  expect(screen.getByText('Owned by')).toBeTruthy();
  expect(screen.getByText('Recorded detail')).toBeTruthy();
  expect(todayData).not.toHaveBeenCalled();
  cleanup();
  render(
    await ThingRoute({
      params: Promise.resolve({ workspace: 'queries' }),
      searchParams: Promise.resolve({ id: 'svc-missing' }),
    }),
  );
  expect(screen.getByText('Nothing here goes by that name.')).toBeTruthy();
  expect(todayData).not.toHaveBeenCalled();
});

it('opens the external reached from its canonical link', async () => {
  const index = indexOf(queryModel());
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(index);
  vi.mocked(readModelPlans).mockResolvedValue([]);
  const id = new URL(index.href('ext:supplier'), 'http://localhost').searchParams.get('id') ?? '';
  render(
    await ThingRoute({
      params: Promise.resolve({ workspace: 'queries' }),
      searchParams: Promise.resolve({ id }),
    }),
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Supplier' })).toBeTruthy();
});
