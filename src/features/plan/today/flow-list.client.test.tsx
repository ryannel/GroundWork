// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FlowEntry } from '@/application/today-flow-list';

import { FlowList } from './flow-list.client';

let path = '/w/d/s/';
vi.mock(import('next/navigation'), () => ({ usePathname: () => path }));

afterEach(cleanup);

const entry = (id: string, at: string, terms = id): FlowEntry => ({
  id,
  name: id,
  href: `/w/d/s/flows/${id}/`,
  steps: 4,
  here: 2,
  entry: at,
  terms,
});

const many = [
  entry('price', 'API', 'price api redis'),
  entry('purge', 'Worker', 'purge worker cdn'),
  entry('quote', 'API', 'quote api'),
  ...['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, 'Worker')),
];

describe('FlowList', () => {
  it('shows only the flow when there is just one', () => {
    render(<FlowList flows={[entry('price', 'API')]}>drawn</FlowList>);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText('drawn')).toBeTruthy();
  });

  it('groups the flows by where they come in, and marks the first as read on the system page', () => {
    path = '/w/d/s/';
    render(<FlowList flows={many}>drawn</FlowList>);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['API 2', 'Worker 6']);
    expect(screen.getByRole('link', { current: 'page' }).textContent).toContain('price');
    expect(screen.getByRole('link', { name: /quote/u }).textContent).toContain('2 of 4 steps here');
  });

  it('marks the flow whose page is open', () => {
    path = '/w/d/s/flows/purge';
    render(<FlowList flows={many}>drawn</FlowList>);
    expect(screen.getByRole('link', { current: 'page' }).textContent).toContain('purge');
  });

  it('finds flows by anything they touch', () => {
    render(<FlowList flows={many}>drawn</FlowList>);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a flow' }), {
      target: { value: 'CDN' },
    });
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringContaining('purge'),
    ]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nothing' } });
    expect(screen.getByText('No flow touches that.')).toBeTruthy();
  });
});
