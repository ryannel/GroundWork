import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const { plan } = await readPlan('alder-finch', 'storefront-graph');
const m = derive(plan!);
const PRICE = 'sch:gql-product#price';

describe('fieldLadder', () => {
  it('an @override ladder says the old subgraph stops resolving the field and shows every rollout rung', () => {
    const l = m.fieldLadder(PRICE);
    expect(l.rungs.map((r) => r.rung)).toEqual(['expand', 'migrate', 'contract']);
    expect(l.retired).toBe(true);
    expect(l.from).toBe('sg:pricing');
    expect(l.to).toBe('sg:pricing-v2');
    const labels = l.rungs.map((r) => r.label).join(' | ');
    expect(labels).not.toMatch(/price is removed/);
    expect(labels).toMatch(/Pricing subgraph stops resolving price/);
    expect(l.rungs.find((r) => r.rung === 'migrate')?.steps).toEqual([10, 50, 100]);
  });

  it('only a field that moves between subgraphs has rungs; the Model ladder of one is its field ladder', () => {
    expect(m.fieldLadder('sch:gql-product#sku').rungs).toEqual([]);
    expect(m.ladder('sch:gql-product#sku').rungs).toEqual([]);
    expect(m.ladder(PRICE)).toEqual(m.fieldLadder(PRICE));
  });
});
