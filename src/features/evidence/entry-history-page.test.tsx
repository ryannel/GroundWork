// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type { EntryHistory } from '@/application/entry-history';

import { EntryHistoryPage } from './entry-history-page';

const { push } = vi.hoisted(() => ({
  push: vi.fn<(href: string, options: { readonly scroll: boolean }) => void>(),
}));
vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useRouter: () => ({ push }) as unknown as ReturnType<typeof actual.useRouter>,
  };
});

const selected: Extract<EntryHistory, { readonly kind: 'snapshot' }> = {
  kind: 'snapshot',
  scope: {
    key: 'archive',
    publication: 'fallback',
    service: 'pretax',
    name: 'Pretax',
    repo: 'acme/pretax',
    commit: 'a'.repeat(40),
  },
  entries: [],
  file: 'flow.json',
  selected: 'order',
  links: ['data.json'],
  complete: true,
  overview: 'overview.json',
  callers: 'callers.json',
  page: {
    format: 'service-explorer-page/v1',
    snapshot: 'original',
    kind: 'flow',
    title: 'Place an order',
    description: 'Original entry',
    nodes: [
      { id: 'order', label: 'Order', detail: '', kind: 'entry', sourceIds: [], target: null },
      {
        id: 'store',
        label: 'Store',
        detail: '',
        kind: 'storage',
        sourceIds: [],
        target: 'data.json',
      },
    ],
    links: [
      { id: 'write', from: 'order', to: 'store', label: 'Writes', kind: 'data', sourceIds: [] },
    ],
    fields: [],
    sources: [],
    gaps: [],
    completeSelection: true,
  },
};

afterEach(cleanup);

it('connects the selected historical node to its recorded neighbour and nested data', () => {
  const page = render(<EntryHistoryPage history={selected} workspace="acme" />);
  expect(screen.getByText('To · data · Writes')).toBeTruthy();
  const connection = screen.getByText('To · data · Writes').parentElement;
  if (connection === null) throw new Error('Missing connection');
  expect(within(connection).getByRole('link', { name: 'Store' }).getAttribute('href')).toBe(
    '/acme/explorer?service=pretax&page=flow.json&node=store',
  );
  fireEvent.click(screen.getByRole('button', { name: 'storage: Store' }));
  expect(push).toHaveBeenCalledWith('/acme/explorer/?scope=archive&page=flow.json&node=store', {
    scroll: false,
  });
  page.rerender(<EntryHistoryPage history={{ ...selected, selected: 'store' }} workspace="acme" />);
  expect(screen.getByText('From · data · Writes')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open linked detail' }).getAttribute('href')).toBe(
    '/acme/explorer?service=pretax&page=data.json',
  );
});

it('keeps the fallback data source pin distinct from the browsing scope', () => {
  const pin = 'b'.repeat(40);
  render(
    <EntryHistoryPage
      history={{
        ...selected,
        file: 'data.json',
        selected: null,
        page: {
          ...selected.page,
          kind: 'data',
          nodes: [],
          links: [],
          sources: [
            {
              id: 'schema',
              label: 'Original schema',
              url: `https://github.com/acme/orders/blob/${pin}/schema.graphql#L1-L6`,
            },
          ],
        },
      }}
      workspace="acme"
    />,
  );
  expect(screen.getByText(/Browsing acme\/pretax/u)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: /Data source · acme\/orders/u }).getAttribute('href'),
  ).toBe(`https://github.com/acme/orders/tree/${pin}`);
});
