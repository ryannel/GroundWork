import { describe, expect, it } from 'vitest';

import { asIsOf, byId, fetchesOf, field, shop, states } from '@/../test/federation-kit';
import { derive } from '@/application/plan/derive';
import { blastRadius, fieldOwners } from '@/application/plan/federation-blast';
import { cachePath } from '@/application/plan/federation-cache';
import { parseDocument, parseTypeRef } from '@/application/plan/federation-parse';
import { queryPlan } from '@/application/plan/federation-plan';
import { responsePolicy } from '@/application/plan/federation-policy';
import { selectionTree } from '@/application/plan/federation-tree';

describe('parseDocument', () => {
  it('reads the header, variables, aliases and merges fragments', () => {
    const d = parseDocument(`
      # a comment
      query Page($sku: ID!, $n: Int = 3, $tags: [String!]) {
        p: product(sku: $sku, filter: { a: [1, 2], b: "x)" }) @include(if: true) {
          ...Hero
          ... on Product { price { amount } }
          ... @skip(if: false) { sku }
          price { currency }
        }
      }
      fragment Hero on Product { sku title: name }`);
    expect(d.ok).toBe(true);
    expect(d.kind).toBe('query');
    expect(d.name).toBe('Page');
    expect(d.variables).toEqual([
      { name: 'sku', type: 'ID!', required: true },
      { name: 'n', type: 'Int', required: false },
      { name: 'tags', type: '[String!]', required: false },
    ]);
    const p = d.selections[0]!;
    const kids = p.selections!;
    expect(p.key).toBe('p');
    expect(p.name).toBe('product');
    expect(kids.map((s) => s.key)).toEqual(['sku', 'title', 'price']);
    expect(kids[1]?.name).toBe('name');
    expect(kids[2]?.selections!.map((s) => s.name)).toEqual(['amount', 'currency']);
  });

  it('reads shorthand queries, mutations and block strings, and never throws', () => {
    expect(parseDocument('{ a }').kind).toBe('query');
    expect(parseDocument('mutation M { add(note: """multi\nline""") { id } }').kind).toBe(
      'mutation',
    );
    expect(parseDocument('query { a { b }').error).toMatch(/expected|end of the document/u);
    expect(parseDocument('query { ...Nope }').error).toMatch(/Nope is spread but never defined/u);
    expect(parseDocument('').error).toMatch(/empty/u);
    expect(parseDocument(null).ok).toBe(false);
  });

  it('reads type strings', () => {
    expect(parseTypeRef('[Product!]!')).toEqual({
      name: 'Product',
      list: true,
      nonNull: true,
      itemNonNull: true,
    });
    expect(parseTypeRef('Money')).toEqual({
      name: 'Money',
      list: false,
      nonNull: false,
      itemNonNull: false,
    });
  });

  it('resolves paths, types and list markers in the selection tree', () => {
    const t = selectionTree(asIsOf(shop()), 'gql:cart-summary');
    expect(t.errors).toEqual([]);
    const n = (at: string) => t.all.find((x) => x.path === at);
    expect(n('cart')?.type).toBe('sch:gql-cart');
    expect(n('cart.lines')?.list).toBe(true);
    expect(n('cart.lines.product.name')?.underList).toBe(true);
    expect(n('cart.subtotal.amount')?.underList).toBe(false);
    expect(n('cart.lines.product.name')?.field).toBe('sch:gql-product#name');
  });
});

describe('queryPlan', () => {
  it('roots at the owner of Query.product and fetches entities after it in parallel', () => {
    const p = queryPlan(asIsOf(shop()), 'gql:product-page');
    expect(fetchesOf(p)).toEqual(['f1 product', 'f2 pricing after f1', 'f3 inventory after f1']);
    expect(p.fetches[0]?.kind).toBe('root');
    expect(p.roundTrips).toBe(2);
    expect(p.parallelism).toBe(2);
    expect(p.levels).toEqual([['f1'], ['f2', 'f3']]);
    expect(p.teams).toEqual(['team:catalog', 'team:pricing', 'team:fulfil']);
    expect(p.services).toEqual([
      'svc:product-graph',
      'svc:pricing-graph',
      'svc:inventory-graph',
      'svc:pricing-api',
    ]);
    expect(p.fetches[1]?.vias).toEqual([
      { field: 'sch:gql-product#price', via: 'api:pricing-price', to: 'svc:pricing-api' },
    ]);
    expect(p.fetches[1]?.reads[0]?.svc).toBe('svc:pricing-api');
    expect(p.stores).toEqual(expect.arrayContaining(['st:price-redis', 'st:pricing-db']));
    expect(p.warnings).toEqual([]);
    expect(
      p.selected.some(
        (s) => s.path === 'product.title' && s.field === 'sch:gql-product#name' && s.fetch === 'f1',
      ),
    ).toBe(true);
  });

  it('keeps a shareable field in the fetch already there', () => {
    expect(fetchesOf(queryPlan(asIsOf(shop()), 'gql:search'))).toEqual([
      'f1 search',
      'f2 inventory after f1',
    ]);
  });

  it('lets provides remove a hop; without it the product subgraph is asked', () => {
    const p = shop();
    const name = field(p, 'sch:gql-product', 'name');
    name.subgraphs = ['sg:product'];
    delete name.shareable;
    expect(fetchesOf(queryPlan(asIsOf(p), 'gql:search'))).toEqual([
      'f1 search',
      'f2 inventory after f1',
    ]);
    delete field(p, 'sch:gql-query', 'search').provides;
    expect(fetchesOf(queryPlan(asIsOf(p), 'gql:search'))).toEqual([
      'f1 search',
      'f2 product after f1',
      'f3 inventory after f1',
    ]);
  });

  it('adds depth and gateway-selected fields for requires', () => {
    const m = derive(shop());
    const p = m.queryPlan('gql:product-page');
    expect(fetchesOf(p)).toEqual([
      'f1 product',
      'f2 pricing-v2 after f1',
      'f3 inventory after f1',
      'f4 promise after f1,f3',
    ]);
    expect(p.roundTrips).toBe(3);
    expect(p.fetches[2]?.requiredFields).toEqual(['sch:gql-stock#fc']);
    expect(
      p.addedByRouter.some(
        (a) => a.path === 'product.stock.fc' && a.reason === 'requires' && a.fetch === 'f3',
      ),
    ).toBe(true);
    expect(
      p.selected.some((s) => s.path === 'product.stock.fc' && s.addedByRouter === 'requires'),
    ).toBe(true);
    expect(m.queryPlan('gql:product-page', 'asIs').roundTrips).toBe(2);
  });

  it('translates keys: search → (sku → id) through product → reviews', () => {
    const p = queryPlan(asIsOf(shop()), 'gql:search-reviews');
    expect(fetchesOf(p)).toEqual(['f1 search', 'f2 product after f1', 'f3 reviews after f2']);
    expect(p.fetches[1]?.intermediate).toBe(true);
    expect(p.roundTrips).toBe(3);
    expect(
      p.addedByRouter.some(
        (a) => a.field === 'sch:gql-product#id' && a.fetch === 'f2' && a.reason === 'key',
      ),
    ).toBe(true);
  });

  it('reaches a subgraph by a key it lists when the one before resolves the key fields', () => {
    const p = shop();
    byId(p.schemas, 'sch:gql-product').keys![1]!.in = ['sg:reviews'];
    const plan = queryPlan(asIsOf(p), 'gql:search-reviews');
    expect(fetchesOf(plan)).toEqual(['f1 search', 'f2 product after f1', 'f3 reviews after f2']);
    expect(plan.warnings).toEqual([]);
  });

  it('warns and plans no fetch when no key is shared', () => {
    const p = shop();
    byId(p.schemas, 'sch:gql-product').keys![1]!.in = ['sg:reviews'];
    field(p, 'sch:gql-product', 'id').subgraphs = ['sg:reviews'];
    const plan = queryPlan(asIsOf(p), 'gql:search-reviews');
    expect(fetchesOf(plan)).toEqual(['f1 search']);
    expect(plan.warnings[0]?.message).toMatch(
      /Product cannot be reached from Search by Reviews: no shared key/u,
    );
    expect(plan.warnings[0]?.code).toBe('no-shared-key');
  });

  it('batches below a list with a dataloader and warns of an N+1 without one', () => {
    const p = shop();
    let plan = queryPlan(asIsOf(p), 'gql:search');
    const second = () => plan.fetches[1]!;
    expect([second().list, second().batched, second().nPlusOne, second().representations]).toEqual([
      true,
      false,
      true,
      'n',
    ]);
    byId(p.subgraphs, 'sg:inventory').batching = 'dataloader';
    plan = queryPlan(asIsOf(p), 'gql:search');
    expect([second().batched, second().nPlusOne]).toEqual([true, false]);
    field(p, 'sch:gql-product', 'stock').batched = false;
    expect(queryPlan(asIsOf(p), 'gql:search').fetches[1]?.nPlusOne).toBe(true);
    const cart = queryPlan(asIsOf(shop()), 'gql:cart-summary');
    expect(fetchesOf(cart)).toEqual(['f1 cart', 'f2 product after f1', 'f3 pricing after f1']);
    expect(cart.fetches.slice(1).every((f) => f.list && f.batched)).toBe(true);
    expect(queryPlan(asIsOf(shop()), 'gql:product-page').fetches.some((f) => f.list)).toBe(false);
  });

  it('runs mutation fields one after another, and query root fields to one subgraph together', () => {
    const p = shop();
    byId(p.operations, 'gql:add-to-cart').document =
      'mutation Two { a: addToCart(sku: "1", qty: 1) { id } b: addToCart(sku: "2", qty: 1) { id } }';
    const plan = queryPlan(asIsOf(p), 'gql:add-to-cart');
    expect(fetchesOf(plan)).toEqual(['f1 cart', 'f2 cart after f1']);
    expect(plan.roundTrips).toBe(2);
    const q = shop();
    byId(q.operations, 'gql:search').document =
      'query Two { a: search(q: "x") { sku } b: search(q: "y") { sku } }';
    expect(fetchesOf(queryPlan(asIsOf(q), 'gql:search'))).toEqual(['f1 search']);
  });

  it('warns when the registry plan disagrees', () => {
    const p = shop();
    byId(p.operations, 'gql:product-page').plan_check = { fetches: 4, round_trips: 2 };
    expect(queryPlan(asIsOf(p), 'gql:product-page').warnings[0]?.message).toMatch(
      /ProductPage: derived 3 fetches, registry says 4/u,
    );
  });

  it('derives no plan for subscriptions and unknown operations, and never throws', () => {
    const p = shop();
    Object.assign(byId(p.operations, 'gql:search'), {
      kind: 'subscription',
      document: 'subscription S { search(q: "x") { sku } }',
    });
    const plan = queryPlan(asIsOf(p), 'gql:search');
    expect(plan.fetches).toHaveLength(0);
    expect(plan.warnings[0]?.code).toBe('subscription');
    expect(queryPlan(asIsOf(p), 'gql:nope').warnings[0]?.code).toBe('unknown-operation');
  });
});

describe('responsePolicy', () => {
  it('takes the minimum max-age over the selected fields; scalar leaves inherit', () => {
    const pol = responsePolicy(asIsOf(shop()), 'gql:product-page');
    expect([pol.maxAge, pol.scope, pol.cacheable, pol.method]).toEqual([30, 'public', true, 'GET']);
    expect(pol.limitedBy?.field).toBe('sch:gql-product#stock');
    expect(pol.why).toBe('cached for 30 s, limited by Product.stock');
    expect(pol.overrides).toEqual([
      {
        at: 'st:edge-cache',
        layer: 'edge',
        ttl: 600,
        reason: 'stock is shown as in/out only',
        exceeds: true,
        onUncacheable: false,
      },
    ]);
  });

  it('gives a composite field without a hint its subgraph default (0 unless set)', () => {
    const p = shop();
    delete field(p, 'sch:gql-query', 'product').cache_control;
    let pol = responsePolicy(asIsOf(p), 'gql:product-page');
    expect(pol.maxAge).toBe(0);
    expect(pol.cacheable).toBe(false);
    expect(pol.why).toMatch(
      /Query\.product has no cache hint, so it takes Product's default of 0 s/u,
    );
    byId(p.subgraphs, 'sg:product').cache_control_default = 120;
    pol = responsePolicy(asIsOf(p), 'gql:product-page');
    expect(pol.maxAge).toBe(30);
  });

  it('makes a response private through auth or scope; POST and mutations never cache', () => {
    const g = asIsOf(shop());
    const cart = responsePolicy(g, 'gql:cart-summary');
    expect(cart.scope).toBe('private');
    expect(cart.private.map((x) => [x.field, x.reason, x.auth])).toEqual([
      ['sch:gql-query#cart', 'auth', 'shopper session'],
    ]);
    expect(cart.why).toMatch(/Query\.cart is private \(auth: shopper session\)/u);
    expect(responsePolicy(g, 'gql:add-to-cart').why).toBe('a mutation is never cached');
    const p = shop();
    byId(p.operations, 'gql:product-page').method = 'POST';
    const post = responsePolicy(asIsOf(p), 'gql:product-page');
    expect(post.cacheable).toBe(false);
    expect(post.why).toMatch(/sent as POST/u);
    const q = shop();
    field(q, 'sch:gql-product', 'stock').cache_control!.scope = 'private';
    expect(responsePolicy(asIsOf(q), 'gql:product-page').private[0]?.reason).toBe('scope');
  });
});

describe('cachePath', () => {
  it('walks three cases: all hit, edge miss, cold (rows dim, never disappear)', () => {
    const g = asIsOf(shop());
    const hit = cachePath(g, 'gql:product-page', 'hit');
    expect(states(hit)).toEqual(['edge-cache:hit', 'entity-cache:skipped', 'price-redis:skipped']);
    expect(hit.answeredBy).toBe('st:edge-cache');
    expect(hit.layers[0]?.latency).toBe(15);
    expect(hit.layers[0]?.ttl).toBe(600);
    expect(hit.layers[0]?.ttlSource).toBe('override');
    expect(hit.fetches.every((f) => f.state === 'skipped')).toBe(true);
    const miss = cachePath(g, 'gql:product-page', 'miss');
    expect(states(miss)).toEqual(['edge-cache:miss', 'entity-cache:hit', 'price-redis:skipped']);
    expect(miss.layers[0]?.fills).toBe(true);
    expect(
      miss.layers[1]?.perFetch?.map((p) => `${p.subgraph}:${p.state}:${String(p.ttl)}`),
    ).toEqual(['sg:product:hit:3600', 'sg:pricing:hit:300', 'sg:inventory:hit:30']);
    const cold = cachePath(g, 'gql:product-page');
    expect(cold.case).toBe('cold');
    expect(states(cold)).toEqual(['edge-cache:miss', 'entity-cache:miss', 'price-redis:miss']);
    expect(cold.layers.every((l) => l.fills)).toBe(true);
    expect(cold.fetches.every((f) => f.state === 'run')).toBe(true);
    expect(cold.layers[2]?.fetch).toBe('f2');
    expect(cold.layers[0]?.invalidatedBy).toEqual(['msg:price-published']);
    expect(cold.layers[0]?.purgedIn).toEqual(['flow:price-purge#purge']);
  });

  it('blocks the edge for a private response with the reason; the entity cache answers the public fetches', () => {
    const p = shop();
    byId(p.operations, 'gql:cart-summary').cache!.unshift({ at: 'st:edge-cache' });
    const c = cachePath(asIsOf(p), 'gql:cart-summary', 'hit');
    expect(c.layers[0]?.state).toBe('blocked');
    expect(c.layers[0]?.why).toMatch(/Query\.cart is private/u);
    expect(c.layers[1]?.state).toBe('hit');
    expect(c.layers[1]?.perFetch?.map((x) => `${x.subgraph}:${x.state}`)).toEqual([
      'sg:cart:skipped',
      'sg:product:hit',
      'sg:pricing:hit',
    ]);
    expect(c.fetches.map((f) => f.state)).toEqual(['run', 'skipped', 'skipped']);
  });

  it('leaves a cache store without a layer off the path; a field has its own data cache path', () => {
    const p = shop();
    delete byId(p.stores, 'st:edge-cache').layer;
    expect(states(cachePath(asIsOf(p), 'gql:product-page'))).toEqual([
      'entity-cache:miss',
      'price-redis:miss',
    ]);
    const f = cachePath(asIsOf(shop()), 'sch:gql-product#price', 'hit');
    expect(states(f)).toEqual(['price-redis:hit']);
    expect(f.layers[0]?.ttl).toBe(30);
  });
});

describe('blastRadius', () => {
  it('nulls the nearest nullable ancestor of a failed non-null field', () => {
    const b = blastRadius(asIsOf(shop()), 'gql:product-page');
    expect(b.map((x) => x.message)).toEqual([
      'if Product fails, `product` is null',
      'if Pricing fails, `product` is null because `product.price` is `Money!`',
      'if Inventory fails, `product` is null because `product.stock` is `Stock!`',
    ]);
    const add = blastRadius(asIsOf(shop()), 'gql:add-to-cart');
    expect(add[0]?.wholeResponse).toBe(true);
    expect(add[0]?.message).toMatch(/the whole response is empty because `addToCart` is `Cart!`/u);
    const p = shop();
    field(p, 'sch:gql-product', 'reviews').type = '[Review!]';
    const r = blastRadius(asIsOf(p), 'gql:search-reviews');
    expect(r.map((x) => [x.wholeResponse, x.nulls.map((n) => n.path)])).toEqual([
      [true, []],
      [false, ['search.reviews']],
      [false, ['search.reviews']],
    ]);
  });
});

describe('fieldOwners', () => {
  it('lists owners per subgraph; key fields count for every subgraph in their key, and stubs', () => {
    const o = fieldOwners(asIsOf(shop()), 'sch:gql-product');
    expect(o.bySubgraph['sg:cart']).toContain('sch:gql-product#sku');
    expect(o.bySubgraph['sg:reviews']).toEqual(['sch:gql-product#id', 'sch:gql-product#reviews']);
    expect(o.stubs).toEqual(['sg:cart', 'sg:search']);
    expect(o.keyFields).toEqual(['sch:gql-product#sku', 'sch:gql-product#id']);
  });
});
