// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { deliveryTime } from '@/../test/fixtures/acme/plans/contracts-delivery-time';
import { contractsPlans } from '@/../test/fixtures/acme/plans/contracts-plans';
import { modelOf } from '@/../test/plan-kit';

import { StoreGrid } from './store-grid';

afterEach(cleanup);

describe('StoreGrid', () => {
  it.each(contractsPlans())('draws %s with a column per store and every cell named', (_, plan) => {
    const model = modelOf(plan);
    const { container } = render(<StoreGrid model={model} />);
    const stores = model.storeGrid('asIs').stores.length;
    expect(stores).toBeGreaterThan(0);
    expect(container.querySelectorAll('thead th')).toHaveLength(stores + 1);
    const cells = [...container.querySelectorAll('button[data-access]')];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.getAttribute('aria-label')).toMatch(/reads|writes/u);
  });

  it('says so when no databases are recorded', () => {
    const plan = shop();
    plan.stores = [];
    const { container } = render(<StoreGrid model={modelOf(plan)} />);
    expect(container.textContent).toContain('No databases');
  });

  it('marks what the plan adds in the diff, and nothing in today', () => {
    const model = modelOf(deliveryTime());
    expect(model.storeGrid('toBe').stores).toContain('st:delivery-times');
    const diff = render(<StoreGrid mode="diff" model={model} />);
    expect(diff.container.querySelector('[data-status="added"]')).not.toBeNull();
    cleanup();
    const today = render(<StoreGrid model={model} />);
    expect(today.container.querySelector('[data-status="added"]')).toBeNull();
  });

  it('dims other teams and names idle systems in a footnote when compact', () => {
    const model = modelOf(shop());
    const { container } = render(<StoreGrid compact lens="team:web" model={model} />);
    expect(container.querySelector('tr[data-dim]')).not.toBeNull();
    expect(container.querySelector('[role="note"]')?.textContent).toContain('reads');
  });

  it('marks what it is asked to', () => {
    const model = modelOf(shop());
    const { container } = render(<StoreGrid highlight={['st:catalog-db']} model={model} />);
    expect(container.querySelector('th[data-mark]')).not.toBeNull();
  });
});
