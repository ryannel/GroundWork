// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlanRow } from '@/application/plan-index';

import { PlansPage } from './index';

let search = '';
vi.mock(import('next/navigation'), () => ({
  useSearchParams: () => new URLSearchParams(search) as never,
}));

afterEach(() => {
  cleanup();
  search = '';
});

const row = (id: string, more: Partial<PlanRow>): PlanRow => ({
  id,
  title: id,
  href: `/shop/plans/${id}/`,
  summary: '',
  stage: 'draft',
  date: null,
  domains: [],
  workItems: 0,
  done: 0,
  ...more,
});

const rows: PlanRow[] = [
  row('prices', { title: 'New prices', domains: ['sales'], date: '2026-02-01', stage: 'review' }),
  row('stock', { title: 'Reserve stock', domains: ['stock'], date: '2026-03-01' }),
  row('vat', {
    title: 'VAT on invoices',
    summary: 'Invoices carry the VAT number.',
    domains: ['sales', 'stock'],
    date: '2025-01-01',
    stage: 'delivery',
    workItems: 4,
    done: 1,
  }),
];
const domains = [
  { id: 'sales', name: 'Sales' },
  { id: 'stock', name: 'Stock' },
];

const titles = () =>
  within(screen.getByRole('list'))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('PlansPage', () => {
  it('lists every plan newest first, and cuts them by words, domain and stage', () => {
    render(<PlansPage domains={domains} rows={rows} />);
    expect(screen.getByText('3 plans, 3 not yet delivered')).toBeTruthy();
    expect(titles()).toEqual(['Reserve stock', 'New prices', 'VAT on invoices']);
    expect(screen.getByText('1 of 4 work items')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Domain' }), {
      target: { value: 'sales' },
    });
    expect(titles()).toEqual(['New prices', 'VAT on invoices']);
    expect(screen.getByText('2 of 3 plans')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^In review/u }));
    expect(titles()).toEqual(['New prices']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a plan' }), {
      target: { value: 'vat number' },
    });
    expect(titles()).toEqual(['VAT on invoices']);
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(new URL(globalThis.location.href).searchParams.get('domain')).toBe('stock');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a plan' }), {
      target: { value: 'nothing like it' },
    });
    expect(screen.getByText('No plan matches.')).toBeTruthy();
  });

  it('reads its cut from the address and sorts', () => {
    search = 'stage=draft&sort=title';
    render(<PlansPage domains={domains} rows={rows} />);
    expect(titles()).toEqual(['Reserve stock']);
    fireEvent.click(screen.getByRole('button', { name: /^All/u }));
    expect(titles()).toEqual(['New prices', 'Reserve stock', 'VAT on invoices']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), {
      target: { value: 'progress' },
    });
    expect(titles()[0]).toBe('VAT on invoices');
  });

  it('shows fifty at a time', () => {
    const many = Array.from({ length: 120 }, (_, i) => row(`p${String(i)}`, {}));
    render(<PlansPage domains={domains} rows={many} />);
    expect(titles()).toHaveLength(50);
    fireEvent.click(screen.getByRole('button', { name: 'Show 50 more of 70' }));
    expect(titles()).toHaveLength(100);
  });

  it('says how to write a plan when there are none', () => {
    render(<PlansPage domains={domains} rows={[]} />);
    expect(screen.getByText('No plans yet')).toBeTruthy();
  });
});
