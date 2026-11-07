// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { flowFixture } from '@/../test/fixtures/model-current-flow';
import { indexOf } from '@/application/model-index';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';
import { todayData } from '@/infrastructure/today-data';

import JourneyRoute, { generateMetadata } from './[key]/page';
import JourneysRoute from './page';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/navigation'), () => ({
  usePathname: () => '/queries/journeys/',
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
beforeEach(() => {
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(
    indexOf({
      ...flowFixture(),
      journeys: [
        {
          id: 'jny:unplaced',
          name: 'Unplaced journey',
          summary: 'A retained authored description.',
        },
      ],
    }),
  );
  vi.mocked(readModelPlans).mockResolvedValue([]);
  vi.mocked(todayData).mockRejectedValue(new Error('Legacy reader must not run'));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('lists every native journey and flow through the existing finder without a legacy read', async () => {
  render(await JourneysRoute({ params: Promise.resolve({ workspace: 'queries' }) }));
  expect(screen.getByRole('link', { name: /Unplaced journey/u }).getAttribute('href')).toBe(
    '/queries/journeys/jny-unplaced',
  );
  expect(screen.getByRole('link', { name: /An authored narrative/u })).toBeTruthy();
  expect(todayData).not.toHaveBeenCalled();
});
it('keeps an unplaced journey readable and renders an actual authored flow with its metadata', async () => {
  const params = Promise.resolve({ workspace: 'queries', key: 'jny-unplaced' });
  await expect(generateMetadata({ params })).resolves.toEqual({ title: 'Unplaced journey' });
  render(await JourneyRoute({ params }));
  expect(screen.getByText('A retained authored description.')).toBeTruthy();
  expect(screen.getByText('No authored flows are linked')).toBeTruthy();
  cleanup();
  render(
    await JourneyRoute({ params: Promise.resolve({ workspace: 'queries', key: 'flow-story' }) }),
  );
  expect(screen.getByText('A precise trigger')).toBeTruthy();
  expect(screen.getByText(/Authored narrative/u)).toBeTruthy();
  expect(todayData).not.toHaveBeenCalled();
});
it('keeps an unknown native journey absent rather than trying the legacy reader', async () => {
  await expect(
    JourneyRoute({ params: Promise.resolve({ workspace: 'queries', key: 'missing' }) }),
  ).rejects.toThrow('Not found');
  expect(todayData).not.toHaveBeenCalled();
});
