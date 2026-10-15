import { describe, expect, it } from 'vitest';

import { asIsOf, byId, field, shop, states } from '@/../test/federation-kit';
import { derive } from '@/application/plan/derive';
import { blastRadius } from '@/application/plan/federation-blast';
import { cachePath } from '@/application/plan/federation-cache';
import { federatedFanout } from '@/application/plan/federation-fanout';
import { serviceLinks } from '@/application/plan/graph-queries';
import type { Plan } from '@/domain/plan/plan.generated';

type Step = Parameters<typeof federatedFanout>[1];

describe('fan-out feeds the existing derived relations', () => {
  const m = derive(shop());

  it('a gql: step expands into client → gateway → subgraph services → endpoint hops', () => {
    const f = federatedFanout(m.asIs, m.asIs.get('flow:browse#open') as Step);
    expect(f.calls.map((c) => `${c.from}>${c.to}${c.fanout ? ' F' : ''}`)).toEqual([
      'svc:web>svc:gateway',
      'svc:gateway>svc:product-graph F',
      'svc:gateway>svc:pricing-graph F',
      'svc:gateway>svc:inventory-graph F',
      'svc:pricing-graph>svc:pricing-api F',
    ]);
    expect(
      f.data.some(
        (d) => d.svc === 'svc:pricing-api' && d.store === 'st:pricing-db' && d.rw === 'read',
      ),
    ).toBe(true);
    expect(
      f.data.some(
        (d) => d.svc === 'svc:pricing-graph' && d.store === 'st:price-redis' && d.cache === true,
      ),
    ).toBe(true);
    expect(f.refs).toEqual(
      expect.arrayContaining(['sch:gql-product#stock', 'sg:inventory', 'sch:gql-product']),
    );
    const write = m.fanoutOf('flow:add#add', 'asIs')!.data;
    expect(write.filter((d) => d.rw === 'write').map((d) => [d.svc, d.store])).toEqual([
      ['svc:cart-graph', 'st:cart-db'],
    ]);
    const plain = federatedFanout(m.asIs, m.asIs.get('flow:price-purge#purge') as Step);
    expect(plain.calls).toEqual([
      { from: 'svc:purger', to: 'st:edge-cache', via: 'internal', kind: 'internal', fanout: false },
    ]);
    expect(plain.purges).toEqual([{ svc: 'svc:purger', store: 'st:edge-cache' }]);
  });

  it('edges: api edges per fetch (dashed), data edges per performing service; the diff shows the move', () => {
    const e = m
      .edges('asIs', 'api')
      .map((x) => `${x.from}>${x.to} ${String(x.via)}${x.fanout === true ? ' F' : ''}`);
    expect(e).toContain('svc:gateway>svc:pricing-graph gql:product-page F');
    expect(e).toContain('svc:web>svc:gateway gql:product-page');
    const data = m.edges('asIs', 'data').map((x) => `${x.from}>${x.to}`);
    expect(data).toEqual(
      expect.arrayContaining([
        'svc:pricing-api>st:pricing-db',
        'svc:pricing-graph>st:price-redis',
        'svc:purger>st:edge-cache',
      ]),
    );
    const diff = m
      .edges('diff', 'api')
      .filter((x) => x.via === 'gql:product-page')
      .map((x) => `${String(x.status)} ${x.to}`);
    expect(diff).toEqual(
      expect.arrayContaining([
        'added svc:pricing-v2-graph',
        'removed svc:pricing-graph',
        'added svc:promise-graph',
      ]),
    );
  });

  it('serviceLinks gives every subgraph service a line on the system map', () => {
    const links = serviceLinks(m.asIs, [], federatedFanout).map((l) => `${l.from}>${l.to}`);
    for (const s of [
      'svc:product-graph',
      'svc:pricing-graph',
      'svc:inventory-graph',
      'svc:cart-graph',
    ])
      expect(links, s).toContain(`${s}>svc:gateway`);
    expect(links).toContain('svc:gateway>svc:web');
  });

  it('coverage: field changes touch the steps that fan out to them; contract tests walk a subgraph', () => {
    expect([...m.touchedBy('chg:promise')]).toEqual(['flow:browse#open']);
    expect([...m.touchedBy('chg:price-migrate')]).toEqual(['flow:browse#open']);
    const cov = m.coverage().gaps;
    expect(cov.provesWithoutWalking).toEqual([]);
    expect(cov.connectionsWithoutContract.map((c) => `${c.to} ${c.reason}`)).toEqual([
      'svc:promise-graph fanout-changed',
    ]);
  });

  it('team cut, ownership, rollups and story references', () => {
    expect(m.teamCut('team:pricing').flows).toContain('flow:browse');
    expect(m.ownerService('sch:gql-product#price')).toBe('svc:pricing-v2-graph');
    expect(m.ownerService('sch:gql-product')).toBe('svc:gateway');
    expect(m.ownerService('sg:cart')).toBe('svc:cart-graph');
    expect(m.ownerService('graph:shop')).toBe('svc:gateway');
    expect(m.ownerService('gql:search')).toBe('svc:web');
    expect(m.teamsOf('chg:price-migrate')).toEqual(['team:pricing']);
    expect(m.rollup('graph:shop')).toEqual({
      added: 3,
      modified: 5,
      deprecated: 1,
      removed: 0,
      total: 9,
    });
    expect(m.storyRefs('graph:shop')).toEqual(['today', 'changes']);
    expect(m.storyRefs('sch:gql-product#stock')).toEqual(['today', 'runs']);
    expect(m.teamsBehind('gql:product-page', 'asIs')).toEqual([
      'team:catalog',
      'team:pricing',
      'team:fulfil',
    ]);
    expect(m.cachePath('gql:product-page', 'toBe', 'miss').answeredBy).toBe('st:entity-cache');
    expect(m.blastRadius('gql:product-page')).toHaveLength(4);
    expect(m.fieldOwners('sch:gql-product').bySubgraph['sg:promise']).toBeDefined();
    expect(m.operationsSelecting('sch:gql-product#leadTimeDays')).toEqual([]);
    expect(m.operationsOf('scr:pdp#cart')).toEqual(['gql:cart-summary', 'gql:add-to-cart']);
    expect(m.orphans().filter((x) => x.startsWith('sch:gql-') || x === 'if:graph')).toEqual([]);
  });
});

describe('ops on graph entities: status and ledger lines', () => {
  const m = derive(shop());
  const lines = (c: string) => m.diff(c).map((e) => e.summary);

  it('add a subgraph and a field, deprecate a field', () => {
    expect(m.status('sg:promise')).toBe('added');
    expect(m.status('sch:gql-product#deliveryPromise')).toBe('added');
    expect(m.status('sch:gql-product#leadTimeDays')).toBe('deprecated');
    expect(m.status('gql:product-page')).toBe('modified');
    expect(lines('chg:promise')).toEqual([
      '+ service "Promise graph"',
      '+ subgraph "Promise"',
      'keys: sku now also in Promise',
      '+ deliveryPromise String',
      'document rewritten',
      'plan check: fetches 3 → 4, round trips 2 → 3',
      '− deprecated leadTimeDays → deliveryPromise',
    ]);
  });

  it('move a field by override: expand → migrate → contract, as a ladder', () => {
    expect(m.status('sch:gql-product#price')).toBe('modified');
    expect(lines('chg:price-expand').slice(5)).toEqual([
      'price override: (none) → from Pricing · 10 %',
      '+ subgraphs: Pricing v2',
      '+ access: Pricing v2 graph read',
    ]);
    expect(lines('chg:price-migrate')).toEqual([
      'price override: from Pricing · 10 % → from Pricing · 100 %',
    ]);
    expect(lines('chg:price-contract')).toEqual([
      '− subgraphs: Pricing',
      '− subgraphs: Pricing',
      'price override: from Pricing · 100 % → (none)',
      'price cache: price-redis 30 s → 60 s',
      '− subgraphs: Pricing',
    ]);
    const l = m.ladder('sch:gql-product#price') as unknown as {
      rungs: { rung: string; kind: string; label: string; workItems: string[] }[];
      retired: boolean;
      from: string;
      to: string;
    };
    expect(l.rungs.map((r) => [r.rung, r.kind, r.label])).toEqual([
      ['expand', 'expand', 'Pricing v2 serves price next to Pricing (override 10 %)'],
      ['migrate', 'migrate', 'Pricing v2 takes 100 % of price'],
      ['contract', 'retire', 'Pricing stops resolving price; Pricing v2 has all of it'],
    ]);
    expect(l.retired).toBe(true);
    expect([l.from, l.to]).toEqual(['sg:pricing', 'sg:pricing-v2']);
    expect(l.rungs[0]?.workItems).toEqual(['wi:pricing-v2']);
  });

  it('an operation ttl change reads as "edge cache 600 s → 60 s"; remove reads plainly', () => {
    const p = shop();
    p.changes!.push({
      id: 'chg:ttl',
      title: 'Shorter edge ttl',
      ops: [
        {
          modify: 'gql:product-page',
          set: {
            cache: [{ at: 'st:edge-cache', ttl: 60, reason: 'promise' }, { at: 'st:entity-cache' }],
          },
        },
        { modify: 'st:edge-cache', set: { stale: { while_revalidate: 10 } } },
        { remove: 'sch:gql-product#leadTimeDays' },
        { remove: 'sg:reviews' },
      ],
    } as unknown as NonNullable<Plan['changes']>[number]);
    const d = derive(p);
    expect(d.diff('chg:ttl').map((e) => e.summary)).toEqual([
      'cache: edge cache 600 s → 60 s',
      'stale: (none) → while revalidate 10',
      '× field "leadTimeDays"',
      '× subgraph "Reviews"',
    ]);
    expect(d.status('sg:reviews')).toBe('removed');
    expect(d.graphDiff('graph:shop').subgraphs.map((s) => `${s.id} ${String(s.status)}`)).toEqual([
      'sg:reviews removed',
      'sg:promise added',
      'sg:pricing-v2 added',
    ]);
  });

  it('graphDiff: fields moved, operations whose plan changes, caches', () => {
    const gd = m.graphDiff('graph:shop');
    const price = gd.fields.find((f) => f.id === 'sch:gql-product#price')!;
    expect([price.moved, price.subgraphs.before, price.subgraphs.after]).toEqual([
      true,
      ['sg:pricing'],
      ['sg:pricing-v2'],
    ]);
    const pp = gd.operations.find((o) => o.id === 'gql:product-page')!;
    expect(pp.changed).toEqual(['fetches', 'roundTrips', 'subgraphs']);
    expect([pp.before?.roundTrips, pp.after?.roundTrips]).toEqual([2, 3]);
    expect(gd.operations.some((o) => o.id === 'gql:cart-summary' && o.status === 'existing')).toBe(
      true,
    );
    expect(gd.caches.map((c) => c.id)).toEqual(['st:price-redis']);
    expect(gd.fields.find((f) => f.id === 'sch:gql-product#leadTimeDays')!.usage?.per_day).toBe(
      '1.2M',
    );
  });
});

const upTo = (id: string, percent?: number) => {
  const p = shop();
  p.changes = p.changes!.slice(0, p.changes!.findIndex((c) => c.id === id) + 1);
  if (percent !== undefined) {
    const ops = byId(p.changes, id).ops as unknown as {
      modify?: string;
      set: { override: { percent: number } };
    }[];
    ops.find((o) => o.modify === 'sch:gql-product#price')!.set.override.percent = percent;
  }
  return derive(p);
};
const calls = (m: ReturnType<typeof derive>) => m.fanoutOf('flow:browse#open', 'toBe')!.calls;

describe('review fixes: requires, caches, blast radius, progressive override', () => {
  const promiseOp = {
    id: 'gql:promise',
    name: 'Promise',
    kind: 'query',
    graph: 'graph:shop',
    method: 'GET',
    persisted: 'apq',
    client: 'svc:web',
    screens: ['scr:pdp'],
    document: 'query Promise($sku: ID!) { product(sku: $sku) { deliveryPromise } }',
  };
  const withPromise = (): Plan => {
    const p = shop();
    p.operations!.push(promiseOp as unknown as NonNullable<Plan['operations']>[number]);
    return p;
  };

  it('B1: the fields the gateway adds for @requires count toward the response policy and the entity-cache life', () => {
    const d = derive(withPromise());
    const plan = d.queryPlan('gql:promise');
    expect(
      plan.routerNodes.some((n) => n.path === 'product.stock' && n.$router === 'requires'),
    ).toBe(true);
    const pol = d.responsePolicy('gql:promise');
    expect(pol.maxAge).toBe(30);
    expect(pol.limitedBy?.field).toBe('sch:gql-product#stock');
    const rows = d.cachePath('gql:promise', 'toBe', 'cold').layers;
    const entity = rows.find((r) => r.store === 'st:entity-cache')!;
    expect(entity.perFetch?.find((x) => x.subgraph === 'sg:inventory')?.ttl).toBe(30);
    expect(derive(shop()).queryPlan('gql:product-page').routerNodes.length).toBeGreaterThan(0);
    const q = withPromise();
    field(q, 'sch:gql-product', 'stock').cache_control!.scope = 'private';
    expect(derive(q).responsePolicy('gql:promise').scope).toBe('private');
  });

  it('B2: a partial cache never answers; data caches never answer and hit when their fetch runs', () => {
    const g = asIsOf(shop());
    const hit = cachePath(g, 'gql:cart-summary', 'hit');
    expect(hit.answeredBy).toBeNull();
    expect(hit.partial).toBe('st:entity-cache');
    expect(hit.fetches.some((f) => f.state === 'run')).toBe(true);
    const full = cachePath(g, 'gql:product-page', 'miss');
    expect(full.answeredBy).toBe('st:entity-cache');
    expect(full.partial).toBeNull();
    const p = shop();
    delete byId(p.stores, 'st:entity-cache').layer;
    const miss = cachePath(asIsOf(p), 'gql:product-page', 'miss');
    expect(miss.answeredBy).toBeNull();
    expect(states(miss)).toEqual(['edge-cache:miss', 'price-redis:hit']);
    expect(states(cachePath(asIsOf(p), 'gql:product-page', 'cold'))).toEqual([
      'edge-cache:miss',
      'price-redis:miss',
    ]);
  });

  it('M1: every edge and gateway cache of the graph is a row; what the operation cannot use is blocked', () => {
    const g = asIsOf(shop());
    expect(states(cachePath(g, 'gql:search', 'cold'))).toEqual([
      'edge-cache:miss',
      'entity-cache:miss',
    ]);
    const cart = cachePath(g, 'gql:cart-summary', 'cold');
    expect(cart.layers[0]?.store).toBe('st:edge-cache');
    expect(cart.layers[0]?.state).toBe('blocked');
    expect(cart.layers[0]?.why).toMatch(/Query\.cart is private/);
    expect(states(cachePath(g, 'gql:add-to-cart'))).toEqual([
      'edge-cache:blocked',
      'entity-cache:blocked',
    ]);
    expect(cachePath(g, 'gql:add-to-cart').layers[1]?.why).toMatch(/mutation/);
    const p = shop();
    byId(p.operations, 'gql:search').method = 'POST';
    const post = cachePath(asIsOf(p), 'gql:search');
    expect(post.layers[0]?.state).toBe('blocked');
    expect(post.layers[0]?.why).toMatch(/does not cache POST/);
    const own = cachePath(g, 'gql:product-page');
    expect(own.layers[0]?.ttl).toBe(600);
    expect(own.layers[0]?.reason).toBe('stock is shown as in/out only');
  });

  it('M4: a nullable list item absorbs the null; the message names the field the ! started from', () => {
    const b = blastRadius(asIsOf(shop()), 'gql:cart-summary').find(
      (x) => x.subgraph === 'sg:product',
    )!;
    expect(b.nulls.map((n) => n.path)).toEqual(['cart']);
    expect(b.message).toMatch(
      /`cart` is null because `cart\.lines\.product\.name` is `String!` and every parent up to `cart\.lines` is non-null/,
    );
    const p = shop();
    field(p, 'sch:gql-cart', 'lines').type = '[CartLine]!';
    const l = blastRadius(asIsOf(p), 'gql:cart-summary').find((x) => x.subgraph === 'sg:product')!;
    expect(l.nulls.map((n) => n.path)).toEqual(['cart.lines[]']);
  });

  it('m1: a progressive override adds a call to the minority subgraph with its share', () => {
    const at10 = calls(upTo('chg:price-expand')).find((c) => c.to === 'svc:pricing-v2-graph')!;
    expect([at10.fanout, at10.share, at10.subgraph]).toEqual([true, 10, 'sg:pricing-v2']);
    const at60 = calls(upTo('chg:price-expand', 60)).find((c) => c.to === 'svc:pricing-graph')!;
    expect([at60.fanout, at60.share]).toEqual([true, 40]);
    expect(calls(upTo('chg:price-migrate')).some((c) => c.share !== undefined)).toBe(false);
  });
});
