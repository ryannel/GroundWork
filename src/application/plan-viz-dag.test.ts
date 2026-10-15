import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { dagOf } from '@/application/plan-viz-dag';
import { wrapTitle } from '@/application/plan-viz-dag-text';

vi.mock('server-only', () => ({}));

async function load(slug: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('title wrapping', () => {
  it('breaks at words, three lines at most, with an ellipsis where it overflows', () => {
    expect(wrapTitle('Print the VAT number on the invoice', 19, 3)).toEqual([
      'Print the VAT',
      'number on the',
      'invoice',
    ]);
    const long = wrapTitle('one two three four five six seven eight nine ten eleven twelve', 10, 2);
    expect(long).toHaveLength(2);
    expect(long[1]?.endsWith('…')).toBe(true);
  });

  it('breaks a long word after a slash or a dash', () => {
    expect(wrapTitle('orders/billing-template-render', 12, 4)).toEqual([
      'orders/',
      'billing-',
      'template-',
      'render',
    ]);
  });
});

describe('the dependency graph', () => {
  it('puts each item one column right of its latest dependency', async () => {
    const model = await load('stock-reservation');
    const dag = dagOf(model);
    expect(dag).not.toBeNull();
    const at = new Map(dag?.nodes.map((n) => [n.id, n.x]));
    for (const w of model.plan.work_items ?? []) {
      for (const d of w.depends_on ?? []) expect(at.get(w.id)).toBeGreaterThan(at.get(d) ?? 0);
    }
  });

  it('marks the critical path and draws one edge for each dependency', async () => {
    const model = await load('stock-reservation');
    const dag = dagOf(model);
    const deps = (model.plan.work_items ?? []).reduce((n, w) => n + (w.depends_on ?? []).length, 0);
    expect(dag?.edges).toHaveLength(deps);
    const path = model.criticalPath().path;
    expect(
      dag?.nodes
        .filter((n) => n.critical)
        .map((n) => n.id)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(path.toSorted((a, b) => a.localeCompare(b)));
    expect(dag?.edges.filter((e) => e.kind === 'critical')).toHaveLength(
      Math.max(path.length - 1, 0),
    );
  });

  it('groups the columns into a band for each milestone when asked', async () => {
    const model = await load('stock-reservation');
    const plain = dagOf(model);
    const banded = dagOf(model, { byMilestone: true });
    expect(plain?.bands).toEqual([]);
    expect(banded?.bands.length).toBeGreaterThan(0);
    expect(banded?.h).toBeGreaterThan(plain?.h ?? 0);
  });

  it('fades the cards that are not the lens team’s', async () => {
    const model = await load('stock-reservation');
    const team = model.plan.work_items?.[0]?.team ?? '';
    const dag = dagOf(model, { lens: team });
    const dim = dag?.nodes.filter((n) => n.dim) ?? [];
    expect(dim.length).toBeLessThan(dag?.count ?? 0);
  });

  it('is null for a plan with no work', async () => {
    const model = await load('stock-reservation');
    const bare = derive({ ...model.plan, work_items: [] });
    expect(dagOf(bare)).toBeNull();
  });
});
