// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { HistoryError } from './history-error.client';
import { HistoricalEntries, HistoricalIndex, HistoricalRepositories } from './history-lists.client';

afterEach(cleanup);

it('filters repository, entry and reference indexes while retaining exact destinations', () => {
  render(
    <>
      <HistoricalRepositories
        scopes={[
          {
            key: 'orders-past',
            publication: 'fallback',
            service: 'orders',
            name: 'Orders',
            repo: 'acme/orders',
            commit: 'original',
          },
        ]}
        workspace="acme"
      />
      <HistoricalEntries
        entries={[
          { id: 'capture', file: 'flow.json', label: 'Capture order', native: 'api:capture' },
        ]}
        scope="orders-past"
        workspace="acme"
      />
      <HistoricalIndex
        items={[
          { id: 'write', label: 'Write order', href: '/acme/explorer?page=data.json' },
          { id: 'other', label: 'Ledger', href: null },
        ]}
      />
    </>,
  );
  fireEvent.change(screen.getByLabelText('Find a repository'), { target: { value: 'missing' } });
  expect(screen.queryByRole('link', { name: /Orders · fallback/u })).toBeNull();
  fireEvent.change(screen.getByLabelText('Find a repository'), {
    target: { value: 'ACME/ORDERS' },
  });
  expect(screen.getByRole('link', { name: /Orders · fallback/u }).getAttribute('href')).toBe(
    '/acme/explorer?scope=orders-past',
  );
  fireEvent.change(screen.getByLabelText('Find an entry'), { target: { value: 'missing' } });
  expect(screen.queryByRole('link', { name: 'Current entry' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Find in this index'), { target: { value: 'WRITE' } });
  expect(screen.queryByText('Ledger')).toBeNull();
  expect(screen.getByRole('link', { name: 'Write order' }).getAttribute('href')).toBe(
    '/acme/explorer?page=data.json',
  );
});

it('retries the current historical address after a read failure', () => {
  const retry = vi.fn<() => void>();
  const reload = vi.spyOn(globalThis.location, 'reload').mockImplementation(() => {
    retry();
  });
  try {
    render(<HistoryError />);
    expect(screen.getByText('The selected archive could not be verified.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledOnce();
  } finally {
    reload.mockRestore();
  }
});
