import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { dagOf } from '@/application/plan-viz-dag';
import { wrapTitle } from '@/application/plan-viz-dag-text';

const TODAY = new Date('2026-10-17T00:00:00Z');

const load = () => modelOf(dispatchDate());

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
  it('puts each item one column right of its latest dependency', () => {
    const model = load();
    const dag = dagOf(model, { today: TODAY });
    expect(dag).not.toBeNull();
    const at = new Map(dag?.nodes.map((n) => [n.id, n.x]));
    for (const w of model.plan.work_items ?? []) {
      for (const d of w.depends_on ?? []) expect(at.get(w.id)).toBeGreaterThan(at.get(d) ?? 0);
    }
  });

  it('marks the critical path and draws one edge for each dependency', () => {
    const model = load();
    const dag = dagOf(model, { today: TODAY });
    const deps = (model.plan.work_items ?? []).reduce((n, w) => n + (w.depends_on ?? []).length, 0);
    expect(deps).toBe(6);
    expect(dag?.edges).toHaveLength(deps);
    const path = model.criticalPath().path;
    expect(path).toEqual(['wi:dispatch-field', 'wi:publish-v2', 'wi:orders-v2', 'wi:retire-v1']);
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

  it('groups the columns into a band for each milestone when asked', () => {
    const model = load();
    const plain = dagOf(model, { today: TODAY });
    const banded = dagOf(model, { byMilestone: true, today: TODAY });
    expect(plain?.bands).toEqual([]);
    expect(banded?.bands).toHaveLength(4);
    expect(banded?.h).toBeGreaterThan(plain?.h ?? 0);
  });

  it('fades the cards that are not the lens team’s', () => {
    const model = load();
    const dag = dagOf(model, { lens: 'team:catalogue', today: TODAY });
    expect(dag?.count).toBe(6);
    expect(
      dag?.nodes
        .filter((n) => n.dim)
        .map((n) => n.id)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['wi:orders-v2', 'wi:shop-date']);
  });

  it('is null for a plan with no work', () => {
    const model = load();
    const bare = modelOf({ ...model.plan, work_items: [] });
    expect(dagOf(bare, { today: TODAY })).toBeNull();
  });
});
