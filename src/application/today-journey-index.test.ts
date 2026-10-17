import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { journeyIndexOf } from './today-journey-index';

const data = acme();
const index = journeyIndexOf(data.workspace, data.today.model);
const rows = index.groups.flatMap((g) => g.rows);

describe('journeyIndexOf', () => {
  it('lists every journey and flow once, user journeys first', () => {
    expect(rows).toHaveLength(index.total);
    expect(new Set(rows.map((r) => r.key)).size).toBe(index.total);
    expect(index.groups[0]?.title).toBe('User journeys');
    expect(index.groups[0]?.rows.every((r) => r.kind === 'journey')).toBe(true);
    expect(index.groups.map((g) => [g.title, g.rows.map((r) => r.key)])).toEqual([
      ['User journeys', ['uj-buy']],
      ['Publish', ['flow-publish-product']],
      ['Buy', ['flow-cancel-order', 'flow-place-order']],
    ]);
  });

  it('knows the domains each one has steps in, and offers only those', () => {
    const ids = new Set(data.workspace.domains.map((d) => d.id));
    for (const row of rows) for (const d of row.domains) expect(ids.has(d)).toBe(true);
    const used = new Set(rows.flatMap((r) => r.domains));
    expect(index.domains.map((d) => d.id).every((id) => used.has(id))).toBe(true);
    expect(rows.find((r) => r.key === 'flow-cancel-order')?.domains).toEqual(['orders']);
    expect(rows.find((r) => r.key === 'uj-buy')?.domains).toEqual(['storefront', 'orders']);
  });

  it('can be found by the systems it crosses', () => {
    const row = rows.find((r) => r.key === 'flow-publish-product');
    expect(row?.through).toBe('Products, Search');
    expect(row?.terms).toContain('products search');
  });
});
