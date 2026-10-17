// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { modelOf, planOnAcme } from '@/../test/plan-kit';
import type { Model } from '@/application/plan/derive';
import { bySeverity, recordClaim, recordTeams } from '@/application/plan-story-changes-records';
import type { Op } from '@/domain/plan/plan.generated';

function modelWith(...ops: readonly [Op, ...Op[]]): Model {
  const on = planOnAcme({
    meta: {
      id: 'records',
      title: 'Records',
      version: '1.0',
      date: '2026-05-20',
      status: 'draft',
      authors: ['Orders'],
    },
    problem: { summary: 'Records move.', why: 'To see them said.', goals: ['Say it'] },
    changes: [{ id: 'chg:records', title: 'Move the records', ops: [...ops] }],
  });
  return modelOf(on.plan);
}

describe('a record whose edits are all safe', () => {
  it('says an enum that only reorders becomes its new type', () => {
    const model = modelWith({
      modify: 'sch:order#status',
      set: { type: 'enum(cancelled, placed, paid)' },
    });
    expect(recordClaim(model, 'sch:order')).toBe(
      'Order `status` becomes `enum(cancelled, placed, paid)`',
    );
  });

  it('says a field changes when its type does not', () => {
    expect(
      recordClaim(modelWith({ modify: 'sch:order#status', set: { note: 'Hi' } }), 'sch:order'),
    ).toBe('Order `status` changes');
  });

  it('says a deprecated field still works', () => {
    expect(recordClaim(modelWith({ deprecate: 'sch:product#name' }), 'sch:product')).toBe(
      'Product `name` is deprecated · still works',
    );
  });

  it('counts several new optional fields', () => {
    const model = modelWith(
      { add: 'field', into: 'sch:product', value: { name: 'x', type: 'int' } },
      { add: 'field', into: 'sch:product', value: { name: 'y', type: 'int' } },
    );
    expect(recordClaim(model, 'sch:product')).toBe('Product gains two new fields');
  });

  it('names a lone new field and what else moves', () => {
    expect(recordClaim(modelOf(shopGraph()), 'sch:gql-product')).toBe(
      'Product gains a `deliveryPromise` field; `price` changes, `leadTimeDays` is deprecated · still works',
    );
  });

  it('says a record nobody knows changes, under its label', () => {
    const model = modelWith({ deprecate: 'sch:product#name' });
    expect(recordClaim(model, 'sch:none')).toBe('sch:none changes');
  });
});

describe('a record that breaks someone', () => {
  it('says no service reader is recorded for a breaking edit', () => {
    expect(
      recordClaim(
        modelWith({ modify: 'sch:order#status', set: { type: 'enum(placed, paid, paused)' } }),
        'sch:order',
      ),
    ).toBe('Order’s `status` changes; no service reader is recorded');
    expect(
      recordClaim(
        modelWith({ modify: 'sch:order#total_cents', set: { type: 'string' } }),
        'sch:order',
      ),
    ).toBe('Order’s `total_cents` becomes string; no service reader is recorded');
    expect(recordClaim(modelWith({ remove: 'sch:order#total_cents' }), 'sch:order')).toBe(
      'Order loses `total_cents`; no service reader is recorded',
    );
  });

  it('gives the rule’s reason when an enum gains values readers must handle', () => {
    const model = modelWith({
      modify: 'sch:order#status',
      set: { type: 'enum(placed, paid, cancelled, paused, held)' },
    });
    expect(recordClaim(model, 'sch:order')).toBe(
      'Order’s `status` changes; readers must handle paused, held',
    );
  });

  it('names the reader no change moves', () => {
    expect(
      recordClaim(
        modelWith({ modify: 'sch:search-doc#words', set: { required: true } }),
        'sch:search-doc',
      ),
    ).toBe(
      'SearchDoc’s `words` becomes required, which breaks Search indexer; no change in this plan moves it',
    );
    expect(
      recordClaim(
        modelWith({ modify: 'sch:search-doc#words', set: { type: 'enum(a, b)' } }),
        'sch:search-doc',
      ),
    ).toBe(
      'SearchDoc’s `words` becomes enum(a, b), which breaks Search API; no change in this plan moves it',
    );
    expect(
      recordClaim(
        modelWith({
          add: 'field',
          into: 'sch:product',
          value: { name: 'x', type: 'int', required: true },
        }),
        'sch:product',
      ),
    ).toBe(
      'Product gains required `x`, which breaks Products API; no change in this plan moves it',
    );
  });

  it('says who must move first when the plan moves them', () => {
    expect(recordClaim(modelOf(orderEventV2()), 'sch:order-placed-v1')).toBe(
      'order.placed v1 loses `order_id`; Order mailer must move first',
    );
  });
});

describe('teams and order of records', () => {
  it('puts the owner first and the record that breaks someone first', () => {
    const model = modelWith({ modify: 'sch:search-doc#words', set: { required: true } });
    expect(recordTeams(model, 'sch:search-doc')).toEqual(['team:catalogue']);
    expect(recordTeams(model, 'sch:none')).toEqual([]);
    expect(bySeverity(model, ['sch:order', 'sch:search-doc', 'sch:none'])).toEqual([
      'sch:search-doc',
      'sch:order',
      'sch:none',
    ]);
  });
});
