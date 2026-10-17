// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { HealthStrip } from '@/features/plan/viz/ledger/health-strip';
import { Ledger } from '@/features/plan/viz/ledger/ledger';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
  };
});

afterEach(() => {
  cleanup();
  globalThis.history.replaceState(null, '', '/');
});

const load = () => modelOf(dispatchDate());

describe('ledger', () => {
  it('draws one expandable row per change, grouped by service', () => {
    const model = load();
    const { container } = render(<Ledger model={model} />);
    expect(container.querySelectorAll('details[data-change]')).toHaveLength(6);
    expect(
      [...container.querySelectorAll<HTMLElement>('section header [data-inspect]')].map(
        (e) => e.dataset.inspect,
      ),
    ).toEqual(['svc:products', 'svc:search-indexer', 'svc:order-api', 'svc:shop-web']);
    expect(container.textContent).toContain('open a row for details');
    expect(container.textContent).toContain('What it does');
    expect(container.querySelector('button[data-inspect^="chg:"]')?.textContent).toBe(
      'Open the change',
    );
  });

  it('opens the rows it is told to and can drop the key and the groups', () => {
    const model = load();
    const id = model.plan.changes![0]!.id;
    const { container } = render(
      <Ledger groupBy="none" legend={false} model={model} open={[id]} />,
    );
    expect(container.querySelector(`details[data-change="${id}"]`)?.hasAttribute('open')).toBe(
      true,
    );
    expect(container.querySelector('section header')).toBeNull();
    expect(container.textContent).not.toContain('open a row for details');
  });

  it('groups by team and says when there are no changes', () => {
    const model = load();
    const byTeam = render(<Ledger groupBy="team" model={model} />);
    expect(
      [...byTeam.container.querySelectorAll<HTMLElement>('header [data-inspect^="team:"]')].map(
        (e) => e.dataset.inspect,
      ),
    ).toEqual(['team:web', 'team:orders', 'team:catalogue']);
    byTeam.unmount();
    const none = render(<Ledger model={modelOf({ ...model.plan, changes: [] })} />);
    expect(none.container.textContent).toBe('No changes for this team.');
  });
});

describe('health strip', () => {
  it('shows the counts with their meaning', () => {
    const model = load();
    const { container } = render(<HealthStrip model={model} />);
    expect(container.querySelectorAll('li')).toHaveLength(7);
    expect(container.textContent).toContain('planned edits to the system');
    expect(container.textContent).toContain('GET /products/{sku}');
    const some = render(<HealthStrip keys={['tests']} model={model} />);
    expect(some.container.querySelectorAll('li')).toHaveLength(1);
  });
});
