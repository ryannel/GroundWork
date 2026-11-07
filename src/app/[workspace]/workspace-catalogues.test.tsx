// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { readModelWorkspaceWork } from '@/infrastructure/model-workspace-work';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';

import DomainLanguageRoute from './[domain]/(overview)/language/page';
import LanguageRoute from './language/page';
import PartnerRoute, { generateMetadata as partnerMetadata } from './partners/[team]/page';
import PartnersRoute from './partners/page';
import PeopleRoute from './people/page';
import ProgrammeRoute, {
  generateMetadata as programmeMetadata,
} from './programmes/[programme]/page';
import ProgrammesRoute from './programmes/page';
import CatalogueRoute, { generateMetadata as catalogueMetadata } from './reference/[kind]/page';
import ReferenceRoute from './reference/page';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  const navigate = vi.fn<() => void>();
  return {
    useSearchParams: () => new actual.ReadonlyURLSearchParams(),
    useRouter: () => ({
      back: navigate,
      forward: navigate,
      refresh: navigate,
      push: navigate,
      replace: navigate,
      prefetch: navigate,
      bfcacheId: 'workspace-catalogues',
    }),
    usePathname: () => '/queries/people/',
    notFound: () => {
      throw new Error('Not found');
    },
  };
});
vi.mock(import('@/infrastructure/model-index'), () => ({
  readCanonicalModelIndex: vi.fn<typeof readCanonicalModelIndex>(),
}));
vi.mock(import('@/infrastructure/model-workspace-nav'), () => ({
  readModelWorkspaceNav: vi.fn<typeof readModelWorkspaceNav>(),
}));
vi.mock(import('@/infrastructure/model-workspace-work'), () => ({
  readModelWorkspaceWork: vi.fn<typeof readModelWorkspaceWork>(),
}));
vi.mock(import('@/infrastructure/today-data'), () => ({ todayData: vi.fn<typeof todayData>() }));
vi.mock(import('@/infrastructure/workspace-plan-index'), () => ({
  readWorkspacePlanIndex: vi.fn<typeof readWorkspacePlanIndex>(),
}));
vi.mock(import('@/features/plan'), async (original) => ({
  ...(await original()),
  ModelTodayOverlays: () => <span hidden />,
  TodaySearch: () => <span hidden />,
}));
vi.mock(import('@/features/workspace'), async (original) => ({
  ...(await original()),
  WorkspaceShell: ({ children }: { readonly children: ReactNode }) => <main>{children}</main>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  const base = queryModel();
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(
    indexOf({
      ...base,
      teams: [
        {
          id: 'team:b',
          name: 'Partner B',
          partner: true,
          contacts: [{ name: 'Pat', role: 'Lead' }],
        },
      ],
      programmes: [
        {
          id: 'prog:delivery',
          title: 'Delivery programme',
          outcome: 'A recorded outcome with [[team:b]].',
          decisions: [
            { id: 'dec:local', title: 'Recorded programme decision', status: 'proposed' },
          ],
        },
      ],
      domains: base.domains.map((domain) => ({
        ...domain,
        language: {
          summary: 'Domain words',
          concepts: [{ id: 'con:order', name: 'Order', means: 'The complete order meaning.' }],
        },
      })),
    }),
  );
  vi.mocked(readModelWorkspaceNav).mockResolvedValue([]);
  vi.mocked(readModelWorkspaceWork).mockResolvedValue([
    {
      slug: 'actual-folder',
      landed: false,
      plan: {
        meta: { id: 'plan:proposal', title: 'Recorded proposal', programme: 'prog:delivery' },
        problem: { summary: 'A change' },
        changes: [],
        work_items: [
          { id: 'wi:partner', title: 'Partner task', team: 'team:b', body: 'Full assigned work.' },
        ],
      },
    },
  ]);
});
afterEach(cleanup);
function expectNative() {
  expect(todayData).not.toHaveBeenCalled();
  expect(readWorkspacePlanIndex).not.toHaveBeenCalled();
}
async function params() {
  return await Promise.resolve({ workspace: 'queries' });
}
it('renders the canonical people page and honest actor empty state', async () => {
  render(await PeopleRoute({ params: params() }));
  expect(screen.getByText('Nobody yet')).toBeDefined();
  expectNative();
});
it('renders native workspace and domain language through the existing directory', async () => {
  const { unmount } = render(await LanguageRoute({ params: params() }));
  expect(screen.getByText('Order')).toBeDefined();
  unmount();
  render(
    await DomainLanguageRoute({
      params: Promise.resolve({ workspace: 'queries', domain: 'queries' }),
    }),
  );
  expect(screen.getByText('Domain words')).toBeDefined();
  expect(screen.getByText('Order')).toBeDefined();
  expectNative();
});
it('renders native reference groups and searchable canonical catalogue rows', async () => {
  const { unmount } = render(await ReferenceRoute({ params: params() }));
  expect(screen.getByRole('link', { name: /^Components/u })).toBeDefined();
  unmount();
  render(
    await CatalogueRoute({
      params: Promise.resolve({ workspace: 'queries', kind: 'components' }),
      searchParams: Promise.resolve({ q: 'Supplier' }),
    }),
  );
  expect(screen.getByRole('button', { name: /Supplier/u })).toBeDefined();
  expect(screen.getByText(/1 results/u)).toBeDefined();
  await expect(
    catalogueMetadata({
      params: Promise.resolve({ workspace: 'queries', kind: 'components' }),
    }),
  ).resolves.toEqual({ title: 'Components' });
  expectNative();
});
it('counts repeated operation gaps once while keeping the unknown client visible', async () => {
  const base = queryModel();
  const message = 'A selected graph path is not mapped.';
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(
    indexOf({
      ...base,
      problems: Array.from({ length: 874 }, (_, number) => ({
        id: 'gql:saved',
        kind: 'unmapped_target',
        message,
        reference: `Selection.field${String(number)}`,
      })),
      domains: base.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) => ({
          ...system,
          operations:
            system.id === 'sys:a'
              ? [
                  {
                    id: 'gql:saved',
                    name: 'Saved operation',
                    graph: 'graph:public',
                    document: 'query Saved { field }',
                  },
                ]
              : system.operations,
        })),
      })),
    }),
  );
  render(
    await CatalogueRoute({
      params: Promise.resolve({ workspace: 'queries', kind: 'operations' }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.getByRole('button', { name: /Saved operation/u })).toBeTruthy();
  expect(
    screen.getAllByText('A selected graph path is not mapped. (874 occurrences)'),
  ).toHaveLength(1);
  expect(
    screen.getByText(
      'The client component is unknown; the cited document does not establish an invocation.',
    ),
  ).toBeTruthy();
});

it('renders native partners, exact contacts and reversible Record update action', async () => {
  const { unmount } = render(await PartnersRoute({ params: params() }));
  expect(screen.getByRole('link', { name: 'Partner B' }).getAttribute('href')).toBe(
    '/queries/partners/b',
  );
  expect(screen.getByText(/no recorded state/u)).toBeDefined();
  unmount();
  render(await PartnerRoute({ params: Promise.resolve({ workspace: 'queries', team: 'b' }) }));
  expect(screen.getByText('Pat')).toBeDefined();
  expect(screen.getAllByText('Full assigned work.').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Record update' })).toBeDefined();
  expect(
    screen
      .getAllByRole('link', { name: 'Partner task' })
      .every(
        (link) => link.getAttribute('href') === '/queries/plans/actual-folder/things?id=wi-partner',
      ),
  ).toBe(true);
  await expect(
    partnerMetadata({ params: Promise.resolve({ workspace: 'queries', team: 'b' }) }),
  ).resolves.toEqual({ title: 'Partner B' });
  expectNative();
});
it('renders actual programme slug, full programme and assigned plan without invented status', async () => {
  const { unmount } = render(await ProgrammesRoute({ params: params() }));
  expect(screen.getByRole('link', { name: 'Delivery programme' }).getAttribute('href')).toBe(
    '/queries/programmes/delivery',
  );
  expect(screen.getByText(/not been evaluated/u)).toBeDefined();
  unmount();
  render(
    await ProgrammeRoute({
      params: Promise.resolve({ workspace: 'queries', programme: 'delivery' }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.getByRole('heading', { name: 'Recorded proposal' })).toBeDefined();
  expect(screen.getByText('Recorded programme decision')).toBeDefined();
  expect(screen.getByText('dec:local')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'dec:local' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Partner B' }).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Full assigned work.').length).toBeGreaterThan(0);
  expect(screen.getByText('Open plan; no landed base is recorded.')).toBeDefined();
  await expect(
    programmeMetadata({
      params: Promise.resolve({ workspace: 'queries', programme: 'delivery' }),
    }),
  ).resolves.toEqual({ title: 'Delivery programme' });
  expectNative();
});
it('rejects unknown native catalogue kinds and partners rather than consulting legacy facts', async () => {
  await expect(
    CatalogueRoute({
      params: Promise.resolve({ workspace: 'queries', kind: 'unknown' }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow('Not found');
  await expect(
    PartnerRoute({ params: Promise.resolve({ workspace: 'queries', team: 'unknown' }) }),
  ).rejects.toThrow('Not found');
  expectNative();
});

it('returns absence for a noncanonical workspace without trying legacy catalogue or work readers', async () => {
  vi.mocked(readCanonicalModelIndex).mockResolvedValue(null);
  await expect(PeopleRoute({ params: params() })).rejects.toThrow('Not found');
  await expect(PartnersRoute({ params: params() })).rejects.toThrow('Not found');
  await expect(ProgrammesRoute({ params: params() })).rejects.toThrow('Not found');
  expect(readModelWorkspaceWork).not.toHaveBeenCalled();
  expectNative();
});

it('shows one programme plan at a time with exact links to the other work and its selection', async () => {
  const current = await readModelWorkspaceWork('queries');
  vi.mocked(readModelWorkspaceWork).mockResolvedValue([
    ...current,
    {
      slug: 'second-folder',
      plan: {
        meta: { id: 'plan:second', title: 'Second proposal', programme: 'prog:delivery' },
        problem: { summary: 'Another change' },
        builds_on: ['plan:proposal'],
        changes: [],
        work_items: [
          { id: 'wi:next', title: 'Next task', team: 'team:b', body: 'Exact second body.' },
        ],
      },
    },
  ]);
  const programmeParams = Promise.resolve({ workspace: 'queries', programme: 'delivery' });
  const { unmount } = render(
    await ProgrammeRoute({ params: programmeParams, searchParams: Promise.resolve({}) }),
  );
  expect(screen.getByRole('link', { name: 'Second proposal' }).getAttribute('href')).toBe(
    '/queries/programmes/delivery?plan=second-folder',
  );
  expect(screen.getByRole('link', { name: 'Next task' }).getAttribute('href')).toBe(
    '/queries/plans/second-folder/things?id=wi-next',
  );
  expect(screen.queryByText('Exact second body.')).toBeNull();
  unmount();
  render(
    await ProgrammeRoute({
      params: programmeParams,
      searchParams: Promise.resolve({ plan: 'second-folder' }),
    }),
  );
  expect(screen.getByRole('heading', { name: 'Second proposal' })).toBeDefined();
  expect(screen.getAllByText('Exact second body.').length).toBeGreaterThan(0);
  expect(screen.queryByText('Full assigned work.')).toBeNull();
});
