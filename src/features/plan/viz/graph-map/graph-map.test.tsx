// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS } from '@/features/plan/chapters/chapter-kit';

import { CacheTable } from './cache-table';
import { GraphMap } from './graph-map';
import { GraphPicture } from './graph-picture';
import { OwnershipGrid } from './ownership-grid';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no plan ${plan}`);
  return data.model;
}

const model = await modelOf('storefront-graph');
const graph = 'graph:storefront';

afterEach(cleanup);

describe('GraphPicture', () => {
  it('draws the gateway, its operations and each subgraph', () => {
    const { container } = render(<GraphPicture graphId={graph} model={model} />);
    expect(container.querySelectorAll('[data-sg]')).toHaveLength(model.asIs.subgraphs.length);
    expect(container.querySelectorAll('[data-sgs]')).toHaveLength(5);
    expect(container.textContent).toContain('a hit stops there');
  });

  it('lights the operations that reach a subgraph while it is hovered', () => {
    const { container } = render(<GraphPicture graphId={graph} model={model} />);
    const row = container.querySelector<HTMLElement>('[data-sg]');
    if (row === null) throw new Error('no subgraph row');
    fireEvent.pointerOver(row);
    expect(container.querySelector('[data-tracing]')).not.toBeNull();
    expect(row.dataset.lit).toBe('');
    fireEvent.pointerLeave(container.querySelector('[data-tracing]')!);
    expect(container.querySelector('[data-tracing]')).toBeNull();
    expect(container.querySelector('[data-lit]')).toBeNull();
  });

  it('dims what another team owns', () => {
    const team = model.ownerTeam('sg:pricing') ?? '';
    const { container } = render(<GraphPicture graphId={graph} lens={team} model={model} />);
    expect(container.querySelector('[data-dim]')).not.toBeNull();
  });

  it('draws nothing for an unknown graph', () => {
    const { container } = render(<GraphPicture graphId="graph:none" model={model} />);
    expect(container.querySelector('figure')).toBeNull();
  });
});

describe('OwnershipGrid', () => {
  it('has a column per subgraph and clickable fields', () => {
    const { container } = render(<OwnershipGrid graphId={graph} model={model} />);
    expect(container.querySelectorAll('thead th')).toHaveLength(model.asIs.subgraphs.length + 1);
    expect(container.querySelector('button[data-inspect][data-state="same"]')).not.toBeNull();
  });

  it('strikes what leaves and marks what arrives when given the diff', () => {
    const { container } = render(
      <OwnershipGrid diff={model.graphDiff(graph)} graphId={graph} model={model} />,
    );
    expect(container.querySelector('[data-state="new"]')).not.toBeNull();
    expect(container.querySelector('th[data-status="deprecated"]')).not.toBeNull();
    expect(container.querySelector('th[data-status="added"]')).not.toBeNull();
  });

  it('dims the columns of other teams', () => {
    const team = model.ownerTeam('sg:pricing') ?? '';
    const { container } = render(<OwnershipGrid graphId={graph} lens={team} model={model} />);
    expect(container.querySelector('td[data-dim]')).not.toBeNull();
  });

  it('says so when the graph has no types', () => {
    const { container } = render(<OwnershipGrid graphId="graph:none" model={model} />);
    expect(container.textContent).toContain('No graph types');
  });
});

describe('CacheTable', () => {
  it('lists the caches outermost first', () => {
    const { container } = render(<CacheTable model={model} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]?.textContent).toContain('Edge');
  });

  it('marks what the plan changes and links each purge', () => {
    const { container } = render(
      <CacheTable diff={model.graphDiff(graph)} model={model} purgeHref={(id) => `/flows/${id}`} />,
    );
    expect(container.querySelector('tr[data-status]:not([data-status="same"])')).not.toBeNull();
    expect(container.querySelector('a[href^="/flows/"]')).not.toBeNull();
  });

  it.each(PLANS)('draws the caches of %s, or says there are none', async (plan) => {
    const m = await modelOf(plan);
    const { container, unmount } = render(<CacheTable model={m} />);
    expect(container.textContent).not.toBe('');
    unmount();
  });
});

describe('GraphMap', () => {
  it.each([
    ['picture', 'figure'],
    ['grid', 'table'],
    ['caches', 'table'],
  ] as const)('draws the %s view', (view, selector) => {
    const { container } = render(<GraphMap graphId={graph} model={model} view={view} />);
    expect(container.querySelector(selector)).not.toBeNull();
  });

  it('hands the diff and the purge link to the views that read them', () => {
    const { container } = render(
      <GraphMap
        diff={model.graphDiff(graph)}
        graphId={graph}
        model={model}
        purgeHref={(id) => `/flows/${id}`}
        view="caches"
      />,
    );
    expect(container.querySelector('a[href^="/flows/"]')).not.toBeNull();
  });
});
