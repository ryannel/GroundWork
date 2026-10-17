// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { modelOf } from '@/../test/plan-kit';
import { ladderSummary, versionPair } from '@/application/plan-viz-ladder';

describe('a field that moves between subgraphs', () => {
  it('says where it moves and when the old subgraph stops, with no deadline', () => {
    const model = modelOf(shopGraph());
    expect(ladderSummary(model, 'sch:gql-money#amount')).toEqual({
      headline: '`amount` moves from Pricing to Pricing v2',
      deadline: '',
      retire: 'Pricing stops resolving `amount` in M3, once Pricing v2 serves all of it.',
      sequence: null,
      early: false,
      kind: 'retire',
    });
    expect(versionPair(model, 'sch:gql-money#amount')).toBeNull();
  });
});

describe('a second versioned event', () => {
  it('names both consumers that migrate and badges each version', () => {
    const model = modelOf(orderEventV2());
    expect(ladderSummary(model, 'msg:order-placed')?.deadline).toBe(
      'Order mailer and Order desk have to move to v2 by M2, when v1 is removed; any that has not stops receiving `order.placed`.',
    );
    expect(versionPair(model, 'msg:order-placed')).toEqual({
      side: 'old',
      lead: 'Removed v1',
      other: '→ v2',
    });
    expect(versionPair(model, 'msg:order-placed-v2')).toEqual({
      side: 'new',
      lead: 'New v2',
      other: 'replaces v1',
    });
    expect(versionPair(model, 'sch:order-placed-v2')).toEqual({
      side: 'new',
      lead: 'New order.placed v2',
      other: 'replaces order.placed v1',
    });
  });
});
