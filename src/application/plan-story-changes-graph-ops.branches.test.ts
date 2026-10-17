// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { modelOf } from '@/../test/plan-kit';
import type { GraphDiff, OperationChange } from '@/application/plan/federation-diff';
import type { PlanSummary } from '@/application/plan/federation-model';
import {
  edgeWord,
  graphClaim,
  type OpImpact,
  opImpact,
  opsPhrase,
  routeSummary,
  secsText,
  splitOf,
  splitWhy,
} from '@/application/plan-story-changes-graph-ops';

const model = modelOf(shop());
const base = model.graphDiff('graph:shop');

const summary = (over: Partial<PlanSummary> = {}): PlanSummary => ({
  fetches: 1,
  roundTrips: 1,
  subgraphs: ['sg:a'],
  maxAge: 0,
  scope: 'public',
  cacheable: false,
  ...over,
});

const change = (
  id: string,
  before: PlanSummary | null,
  after: PlanSummary | null,
): OperationChange => ({
  id,
  status: before === null ? 'added' : 'modified',
  before,
  after,
  changed: [],
});

const diffOf = (operations: readonly OperationChange[]): GraphDiff => ({
  ...base,
  fields: [],
  caches: [],
  subgraphs: [],
  operations: [...operations],
});

const row = (id: string, before: PlanSummary | null, after: PlanSummary | null): OpImpact => ({
  id,
  name: model.label(id),
  kind: before === null ? 'new' : 'same',
  delta: 0,
  before,
  after,
  added: [],
  removed: [],
});

describe('seconds and routes', () => {
  it('says whole minutes of two or more in minutes, else seconds', () => {
    expect(secsText(120)).toBe('2 min');
    expect(secsText(600)).toBe('10 min');
    expect(secsText(60)).toBe('60 s');
    expect(secsText(150)).toBe('150 s');
  });

  it('says the same route once, in the singular or plural', () => {
    expect(routeSummary(summary(), summary())).toBe('Same route: 1 round trip, 1 fetch');
    const two = summary({ roundTrips: 2, fetches: 3 });
    expect(routeSummary(two, two)).toBe('Same route: 2 round trips, 3 fetches');
  });

  it('shows only the number that moves as a before and after', () => {
    expect(routeSummary(summary(), summary({ roundTrips: 3 }))).toBe('1 → 3 round trips · 1 fetch');
    expect(routeSummary(summary(), summary({ fetches: 2 }))).toBe('1 round trip · 1 → 2 fetches');
    expect(routeSummary(summary({ roundTrips: 2 }), summary({ fetches: 4 }))).toBe(
      '2 → 1 round trip · 1 → 4 fetches',
    );
  });

  it('counts operations and how many take a new route', () => {
    expect(opsPhrase(0, 0)).toBe('');
    expect(opsPhrase(1, 1)).toBe('One operation takes a different route');
    expect(opsPhrase(3, 3)).toBe('Three operations take a different route');
    expect(opsPhrase(1, 0)).toBe('One operation changes, on the same route');
    expect(opsPhrase(2, 0)).toBe('Two operations change, on the same route');
    expect(opsPhrase(3, 1)).toBe('Three operations change, one on a different route');
  });
});

describe('rows of operations', () => {
  it('puts lost caching first, then most trips added, new, saved and the same, in order', () => {
    const rows = opImpact(
      model,
      diffOf([
        change('gql:search', summary(), summary()),
        change('gql:cart-summary', summary({ roundTrips: 3 }), summary()),
        change('gql:add-to-cart', null, summary()),
        change('gql:search-reviews', summary(), summary({ roundTrips: 2 })),
        change(
          'gql:product-page',
          summary({ subgraphs: ['sg:a', 'sg:b'] }),
          summary({ roundTrips: 4, subgraphs: ['sg:a', 'sg:c'] }),
        ),
        change('gql:lost', summary({ cacheable: true, roundTrips: 2 }), null),
      ]),
    );
    expect(rows.map((r) => [r.id, r.kind, r.delta])).toEqual([
      ['gql:lost', 'lost', -2],
      ['gql:product-page', 'up', 3],
      ['gql:search-reviews', 'up', 1],
      ['gql:add-to-cart', 'new', 0],
      ['gql:cart-summary', 'down', -2],
      ['gql:search', 'same', 0],
    ]);
    expect(rows[1]).toMatchObject({ name: 'ProductPage', added: ['sg:c'], removed: ['sg:b'] });
    expect(rows[3]).toMatchObject({ added: ['sg:a'], removed: [] });
  });

  it('keeps operations that stay cached out of the lost row', () => {
    const rows = opImpact(
      model,
      diffOf([change('gql:search', summary({ cacheable: true }), summary({ cacheable: true }))]),
    );
    expect(rows.map((r) => r.kind)).toEqual(['same']);
  });
});

describe('the edge', () => {
  it('reads the edge cache’s own lifetime when the plan sets one', () => {
    const after = summary({ cacheable: true, maxAge: 30 });
    expect(edgeWord(model, 'gql:product-page', { mode: 'toBe', summary: after })).toBe('10 min');
  });

  it('falls back to the max-age, and says when nothing is cached', () => {
    const cart = (maxAge: number) =>
      edgeWord(model, 'gql:cart-summary', {
        mode: 'toBe',
        summary: summary({ cacheable: true, maxAge }),
      });
    expect(cart(45)).toBe('45 s');
    expect(cart(0)).toBe('not cached');
    expect(
      edgeWord(model, 'gql:search', { mode: 'toBe', summary: summary({ cacheable: true }) }),
    ).toBe('30 s');
    expect(edgeWord(model, 'gql:search', { mode: 'asIs', summary: summary() })).toBe('not cached');
    expect(edgeWord(model, 'gql:search', { mode: 'asIs', summary: null })).toBe('not cached');
  });
});

describe('a split operation', () => {
  const diff = diffOf([
    change('gql:product-page', summary({ roundTrips: 2 }), summary({ roundTrips: 3 })),
    change('gql:search', null, summary({ cacheable: true, maxAge: 30 })),
    change('gql:search-reviews', null, summary()),
  ]);

  it('pairs a new operation with a changed one on the same screen', () => {
    const fresh = row('gql:search', null, summary());
    expect(splitOf(model, diff, fresh)?.id).toBe('gql:product-page');
    expect(splitOf(model, diff, row('gql:search-reviews', null, summary()))).toBeNull();
  });

  it('says a private answer is why', () => {
    const cart = row('gql:cart-summary', summary(), summary());
    expect(splitWhy(model, cart, row('gql:product-page', summary(), summary()))).toBe(
      'its answer is private',
    );
  });

  it('names the variable the key varies by and the trips it adds', () => {
    const page = row('gql:product-page', summary(), summary());
    const cart = row('gql:cart-summary', summary({ roundTrips: 2 }), summary());
    expect(splitWhy(model, page, cart)).toBe(
      'its edge key varies by sku and it adds a round trip to the page',
    );
    const add = row('gql:add-to-cart', summary({ roundTrips: 0 }), summary());
    expect(splitWhy(model, page, add)).toBe('it would add 3 round trips to the page');
  });

  it('falls back to the cache override’s reason, else nothing', () => {
    const page = row('gql:product-page', summary(), summary());
    const add = row('gql:add-to-cart', summary({ roundTrips: 3 }), summary());
    expect(splitWhy(model, page, add)).toBe('stock is shown as in/out only');
    const search = row('gql:search', summary(), summary());
    const reviews = row('gql:search-reviews', summary({ roundTrips: 5 }), summary());
    expect(splitWhy(model, search, reviews)).toBe('');
    expect(splitWhy(model, search, row('gql:search-reviews', null, summary()))).toBe(
      'it would add 2 round trips to the page',
    );
  });
});

describe('the graph claim', () => {
  it('names a single new operation cached at the edge, per the variables it splits on', () => {
    const claim = graphClaim(
      model,
      diffOf([
        change('gql:product-page', summary({ roundTrips: 2 }), summary({ roundTrips: 2 })),
        change('gql:search', null, summary({ cacheable: true, maxAge: 30 })),
      ]),
    );
    expect(claim).toBe('Search is new and cached at the edge for 30 s, per q');
  });

  it('caps the claim at two clauses, losses first', () => {
    const claim = graphClaim(
      model,
      diffOf([
        change('gql:search', null, summary()),
        change('gql:product-page', summary(), summary({ roundTrips: 2 })),
        change('gql:cart-summary', summary({ cacheable: true }), summary()),
      ]),
    );
    expect(claim).toBe(
      'CartSummary is no longer cached at the edge; Estimated round trips: ProductPage goes from 1 to 2 round trips',
    );
  });

  it('names two new operations without a count of more', () => {
    const claim = graphClaim(
      model,
      diffOf([change('gql:search', null, summary()), change('gql:add-to-cart', null, summary())]),
    );
    expect(claim).toBe('Search and AddToCart are new');
  });

  it('marks saved trips as estimated when the registry has no evidence', () => {
    const claim = graphClaim(
      model,
      diffOf([change('gql:product-page', summary({ roundTrips: 3 }), summary())]),
    );
    expect(claim).toBe('Estimated round trips: ProductPage saves round trips');
  });
});
