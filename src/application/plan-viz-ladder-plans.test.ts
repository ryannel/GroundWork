// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { ladderSummary, versionPair } from '@/application/plan-viz-ladder';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no ${plan}`);
  return data.model;
}

describe('a field that moves between subgraphs', () => {
  it('says where it moves and when the old subgraph stops, with no deadline', async () => {
    const model = await modelOf('storefront-graph');
    expect(ladderSummary(model, 'sch:gql-money#amount')).toEqual({
      headline: '`amount` moves from Pricing subgraph to Pricing subgraph v2',
      deadline: '',
      retire:
        'Pricing subgraph stops resolving `amount` in M3, once Pricing subgraph v2 serves all of it.',
      sequence: null,
      early: false,
      kind: 'retire',
    });
    expect(versionPair(model, 'sch:gql-money#amount')).toBeNull();
  });
});

describe('a second versioned event', () => {
  it('names both consumers that migrate and badges each version', async () => {
    const model = await modelOf('delivery-promise');
    expect(ladderSummary(model, 'msg:order-placed')?.deadline).toBe(
      'Notifier and Allocation worker have to move to v2 by M4, when v1 is removed; any that has not stops receiving `order.placed`.',
    );
    expect(versionPair(model, 'msg:order-placed')).toEqual({
      side: 'old',
      lead: 'Removed v1',
      other: '→ v2',
    });
    expect(versionPair(model, 'sch:order-placed-v2')).toEqual({
      side: 'new',
      lead: 'New order.placed v2',
      other: 'replaces order.placed v1',
    });
  });
});
