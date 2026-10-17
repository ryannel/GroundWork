import { describe, expect, it } from 'vitest';

import { coreShop } from '@/../test/fixtures/core-shop';
import { derive } from '@/application/plan/derive';

const m = derive(coreShop());
const PRICE = 'sch:gql-product#price';

describe('fieldLadder', () => {
  it('an @override ladder says the old subgraph stops resolving the field and shows every rollout rung', () => {
    const l = m.fieldLadder(PRICE);
    expect(l.rungs.map((r) => r.rung)).toEqual(['expand', 'migrate', 'contract']);
    expect(l.retired).toBe(true);
    expect(l.from).toBe('sg:pricing');
    expect(l.to).toBe('sg:pricing-v2');
    const labels = l.rungs.map((r) => r.label).join(' | ');
    expect(labels).not.toMatch(/price is removed/u);
    expect(labels).toMatch(/Pricing stops resolving price; Pricing v2 has all of it/u);
    expect(l.rungs.find((r) => r.rung === 'migrate')?.steps).toEqual([10, 50, 100]);
  });

  it('only a field that moves between subgraphs has rungs; the Model ladder of one is its field ladder', () => {
    expect(m.fieldLadder('sch:gql-product#sku').rungs).toEqual([]);
    expect(m.ladder('sch:gql-product#sku').rungs).toEqual([]);
    expect(m.ladder(PRICE)).toEqual(m.fieldLadder(PRICE));
  });
});
