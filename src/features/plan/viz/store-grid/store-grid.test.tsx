// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS } from '@/features/plan/chapters/chapter-kit';

import { StoreGrid } from './store-grid';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no plan ${plan}`);
  return data.model;
}

afterEach(cleanup);

describe('StoreGrid', () => {
  it.each(PLANS)('draws %s with a column per store and every cell named', async (plan) => {
    const model = await modelOf(plan);
    const { container } = render(<StoreGrid model={model} />);
    const stores = model.storeGrid('asIs').stores.length;
    if (stores === 0) {
      expect(container.textContent).toContain('No databases');
      return;
    }
    expect(container.querySelectorAll('thead th')).toHaveLength(stores + 1);
    for (const cell of container.querySelectorAll('button[data-access]')) {
      expect(cell.getAttribute('aria-label')).toMatch(/reads|writes/u);
    }
  });

  it('marks what the plan adds in the diff, and nothing in today', async () => {
    const model = await modelOf('stock-reservation');
    const diff = render(<StoreGrid mode="diff" model={model} />);
    expect(diff.container.querySelector('[data-status="added"]')).not.toBeNull();
    cleanup();
    const today = render(<StoreGrid model={model} />);
    expect(today.container.querySelector('[data-status="added"]')).toBeNull();
  });

  it('dims other teams and names idle systems in a footnote when compact', async () => {
    const model = await modelOf('storefront-graph');
    const team = model.plan.teams[0]?.id ?? '';
    const { container } = render(<StoreGrid compact lens={team} model={model} />);
    expect(container.querySelector('tr[data-dim]')).not.toBeNull();
    expect(container.querySelector('[role="note"]')?.textContent).toContain('reads');
  });

  it('marks what it is asked to', async () => {
    const model = await modelOf('storefront-graph');
    const id = model.storeGrid('asIs').stores[0] ?? '';
    const { container } = render(<StoreGrid highlight={[id]} model={model} />);
    expect(container.querySelector('th[data-mark]')).not.toBeNull();
  });
});
