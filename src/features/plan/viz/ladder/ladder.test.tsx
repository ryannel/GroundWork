// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { ladderIds } from '@/application/plan-viz-ladder-order';
import { Ladder } from '@/features/plan/viz/ladder/ladder';
import { VersionBadge } from '@/features/plan/viz/ladder/version-badge';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load(slug = 'delivery-promise') {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('ladder', () => {
  it('climbs expand, migrate and remove for a versioned event', async () => {
    const model = await load();
    const { container } = render(<Ladder id="msg:product-published" model={model} />);
    const rungs = [...container.querySelectorAll('li')];
    expect(rungs.map((r) => r.dataset.kind)).toEqual([
      'expand',
      'migrate',
      'migrate',
      'migrate',
      'migrate',
      'deprecate',
      'retire',
    ]);
    expect(container.querySelector('li button[data-inspect="svc:catalog-api"]')).not.toBeNull();
    expect(container.textContent).toContain('Expand · migrate · remove');
    expect(container.textContent).toContain('Remove: remove the old version once nobody reads it');
  });

  it('draws nothing for an id with no ladder', async () => {
    const model = await load();
    const { container } = render(<Ladder id="sch:shipment" model={model} />);
    expect(container.textContent).toBe('');
  });

  it('draws a field that moves between subgraphs', async () => {
    const model = await load('storefront-graph');
    const id = ladderIds(model).find((x) => x.includes('#'));
    const { container } = render(<Ladder id={id ?? ''} model={model} />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(1);
  });

  it('badges the two ends of a pair and nothing else', async () => {
    const model = await load();
    const old = render(<VersionBadge id="msg:product-published" model={model} />);
    expect(old.container.textContent).toContain('→ v2');
    expect(old.container.querySelector('[data-side="old"]')).not.toBeNull();
    const next = render(<VersionBadge id="msg:product-published-v2" model={model} />);
    expect(next.container.textContent).toContain('New v2replaces v1');
    const none = render(<VersionBadge id="sch:shipment" model={model} />);
    expect(none.container.textContent).toBe('');
  });
});
