// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ValueFlowArea } from '@/application/workspace-value-flows';

import { ValueFlowsPage } from './value-flows-page.client';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  const { useSyncExternalStore } = await import('react');
  return {
    ...actual,
    useSearchParams: () =>
      new actual.ReadonlyURLSearchParams(
        useSyncExternalStore(
          (notify) => {
            globalThis.addEventListener('popstate', notify);
            return () => {
              globalThis.removeEventListener('popstate', notify);
            };
          },
          () => globalThis.location.search,
          () => globalThis.location.search,
        ),
      ),
  };
});

const areas: readonly ValueFlowArea[] = [
  {
    id: 'commercial',
    name: 'Set prices and market offers',
    purpose: 'Prepare market inputs.',
    flows: [
      {
        id: 'publish-offers',
        title: 'Make offers available',
        summary: 'Offer changes refresh the read view for pricing.',
        systems: ['Offers'],
        href: '/acme/areas/commercial/?flow=publish-offers#value-flow-map',
        search: 'make offers available offer changes refresh read view for pricing offers',
      },
    ],
  },
  {
    id: 'buy',
    name: 'Buy, finance and pay',
    purpose: 'Place an order.',
    flows: [
      {
        id: 'pay',
        title: 'Prepare a payment',
        summary: 'Open a payment session.',
        systems: ['Payment'],
        href: '/acme/areas/buy/?flow=pay#value-flow-map',
        search: 'prepare a payment open a payment session payment',
      },
    ],
  },
];

beforeEach(() => {
  globalThis.history.replaceState({ __NA: true }, '', '/acme/value-flows/');
  const replace = globalThis.history.replaceState.bind(globalThis.history);
  vi.spyOn(globalThis.history, 'replaceState').mockImplementation((state: unknown, unused, url) => {
    replace(state, unused, url);
    // Simulate Next's notification contract: retaining its private state suppresses restoration.
    if (state === null) globalThis.dispatchEvent(new PopStateEvent('popstate'));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Value Flows page', () => {
  it('groups work by area and searches directly into a shareable map target', () => {
    render(<ValueFlowsPage areas={areas} />);
    expect(screen.getByRole('heading', { name: 'Value Flows', level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Buy, finance and pay' })).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a value flow' }), {
      target: { value: 'make offers available' },
    });
    expect(screen.queryByRole('heading', { name: 'Buy, finance and pay' })).toBeNull();
    expect(
      screen.getByRole('link', { name: /Make offers available/u }).getAttribute('href'),
    ).toMatch(/^\/acme\/areas\/commercial\/?\?flow=publish-offers#value-flow-map$/u);
    expect(new URL(globalThis.location.href).searchParams.get('q')).toBe('make offers available');
    expect(screen.getByRole('status').textContent).toBe('1 value flow in 1 area');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('status').textContent).toBe('2 value flows in 2 areas');
  });

  it('restores a query from the address and explains an empty filtered result', () => {
    globalThis.history.replaceState(null, '', '/acme/value-flows/?q=offers&area=buy');
    render(<ValueFlowsPage areas={areas} />);
    expect(screen.getByText('No matching value flows')).toBeTruthy();
    expect(screen.getByRole('searchbox').getAttribute('value')).toBe('offers');
    fireEvent.change(screen.getByRole('combobox', { name: 'Area' }), {
      target: { value: 'commercial' },
    });
    expect(screen.getByRole('link', { name: /Make offers available/u })).toBeTruthy();
    expect(new URL(globalThis.location.href).searchParams.get('area')).toBe('commercial');
  });

  it('provides a clear state for workspaces without authored flows', () => {
    render(<ValueFlowsPage areas={[]} />);
    expect(screen.getByText('No value flows yet')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('takes its filters from the address when navigating within the same catalogue', () => {
    globalThis.history.replaceState(null, '', '/acme/value-flows/?q=offers');
    render(<ValueFlowsPage areas={areas} />);
    expect(screen.getByRole('status').textContent).toBe('1 value flow in 1 area');
    act(() => {
      globalThis.history.pushState(null, '', '/acme/value-flows/');
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('status').textContent).toBe('2 value flows in 2 areas');
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
  });
});
