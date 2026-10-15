import { describe, expect, it } from 'vitest';

import {
  asIsOf,
  byId,
  check,
  expectError,
  expectWarning,
  field,
  has,
  shop,
} from '@/../test/federation-kit';
import { invalidators } from '@/application/plan/federation-policy';
import type { Plan } from '@/domain/plan/plan.generated';

type Rec = Record<string, unknown>;
const pushChange = (p: Plan, ...ops: Rec[]) => {
  p.changes!.push({ id: 'chg:x', title: 'x', ops } as unknown as NonNullable<
    Plan['changes']
  >[number]);
};
const op = (p: Plan, id: string) => byId(p.operations, id);
const step = (p: Plan, flowId: string, id: string) => byId(byId(p.flows, flowId).steps, id);

describe('the shop fixture', () => {
  it('validates clean', () => {
    const { errors, warnings } = check();
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe('validator checks 15–22', () => {
  it('15. a subgraph is served by a backend service, not a UI or the gateway', () => {
    expectWarning((p) => {
      byId(p.subgraphs, 'sg:cart').service = 'svc:web';
    }, /^subgraphs\[4\]\.service: sg:cart is served by svc:web, a ui service/);
    expectWarning((p) => {
      byId(p.subgraphs, 'sg:cart').service = 'svc:gateway';
    }, /sg:cart is served by svc:gateway, the gateway of graph:shop/);
  });

  it('16. graph types: roots, keys, subgraphs of the graph, missing subgraphs, unknown types', () => {
    expectError((p) => {
      delete byId(p.schemas, 'sch:gql-query').root;
    }, /graph:shop has no Query type/);
    expectError((p) => {
      byId(p.schemas, 'sch:gql-mutation').root = 'query';
    }, /graph:shop already has a root: query type/);
    expectError((p) => {
      byId(p.schemas, 'sch:gql-product').keys![0]!.fields = ['sku', 'nope'];
    }, /keys\[0\]\.fields\[1\]: Product has no field nope/);
    expectError((p) => {
      p.graphs!.push({ id: 'graph:other', name: 'Other', gateway: 'svc:gateway' });
      p.subgraphs!.push({
        id: 'sg:x',
        name: 'X',
        graph: 'graph:other',
        service: 'svc:reviews-graph',
      });
      field(p, 'sch:gql-review', 'stars').subgraphs = ['sg:x'];
    }, /sg:x belongs to graph:other, but Review is a type of graph:shop/);
    expectError((p) => {
      field(p, 'sch:gql-stock', 'fc').subgraphs = ['sg:pricing'];
    }, /Stock has fields resolved by sg:inventory, sg:pricing but no keys/);
    expectError((p) => {
      delete field(p, 'sch:gql-product', 'stock').subgraphs;
    }, /Product\.stock has no subgraphs/);
    const unknown =
      /Slug is used by 2 fields of graph:shop \(Product\.id, Product\.name\) but is not modelled/;
    expectWarning((p) => {
      field(p, 'sch:gql-product', 'id').type = 'Slug!';
      field(p, 'sch:gql-product', 'name').type = 'Slug!';
    }, unknown);
    const once = check((p) => {
      field(p, 'sch:gql-product', 'id').type = 'Slug!';
    });
    expect(has(once.warnings, /Slug is used/), 'one use is not worth a warning').toBe(false);
  });

  it('16. composition: shareable, keys per subgraph, requires, provides, override', () => {
    expectError((p) => {
      delete field(p, 'sch:gql-money', 'amount').shareable;
    }, /Money\.amount is resolved by sg:pricing and sg:cart; composition needs shareable: true/);
    expectError((p) => {
      byId(p.schemas, 'sch:gql-product').keys![1]!.in = ['sg:product'];
    }, /sg:reviews resolves Product\.reviews but is in none of Product's keys/);
    expectError((p) => {
      field(p, 'sch:gql-product', 'stock').requires = ['sch:gql-stock#available'];
    }, /Product\.stock requires sch:gql-stock#available, but only its own subgraph resolves that/);
    expectError((p) => {
      field(p, 'sch:gql-query', 'search').provides = ['sch:gql-money#amount'];
    }, /Query\.search provides sch:gql-money#amount, which is not a field of Product/);
    expectError((p) => {
      field(p, 'sch:gql-product', 'price').override = { from: 'sg:product' };
    }, /Product\.price overrides sg:product, which does not resolve it/);
    expectError((p) => {
      field(p, 'sch:gql-product', 'stock').subgraphs = ['sg:nope'];
    }, /sg:nope does not exist/);
  });

  it('16. graph-only props stay on graph types', () => {
    expectError((p) => {
      pushChange(p, {
        add: 'field',
        into: 'sch:price',
        value: { name: 'region', type: 'string', cache_control: { max_age: 5 } },
      });
    }, /sch:price#region carries cache_control, which only fields of a kind: graph-type schema have/);
  });

  it('17. operations: the document parses and resolves; client, kind, writes, subscriptions', () => {
    expectError((p) => {
      op(p, 'gql:search').document = 'query {';
    }, /operations\[1\]\.document: gql:search: Search: the document does not parse/);
    expectError((p) => {
      op(p, 'gql:search').document = 'query S { search(q: "x") { sku bogus } }';
    }, /search\.bogus: Product has no field bogus/);
    expectError((p) => {
      op(p, 'gql:search').document = 'query S { nope { sku } }';
    }, /nope: Query has no field nope/);
    expectError((p) => {
      pushChange(p, { remove: 'sch:gql-product#stock' });
    }, /changes\[4\]\.ops\[0\] removes sch:gql-product#stock while gql:search still selects it/);
    expectError((p) => {
      op(p, 'gql:product-page').client = 'svc:gateway';
    }, /gql:product-page is sent by svc:gateway, but scr:pdp#hero is served by svc:web/);
    expectError((p) => {
      op(p, 'gql:search').kind = 'mutation';
    }, /gql:search's document is a query but kind says mutation/);
    expectWarning((p) => {
      delete op(p, 'gql:add-to-cart').writes;
    }, /gql:add-to-cart is a mutation but names no writes/);
    expectWarning((p) => {
      Object.assign(op(p, 'gql:search'), {
        kind: 'subscription',
        document: 'subscription S { search(q: "x") { sku } }',
      });
    }, /gql:search is a subscription; no query plan/);
  });

  it('18 & 20. caches: kind cache, POST at the edge, ttl overrides, private responses', () => {
    expectWarning((p) => {
      op(p, 'gql:product-page').cache!.push({ at: 'st:catalog-db' });
    }, /gql:product-page caches at st:catalog-db, a database/);
    expectWarning((p) => {
      field(p, 'sch:gql-product', 'price').cache = [{ at: 'st:catalog-db' }];
    }, /Product\.price caches in st:catalog-db, a database/);
    expectWarning((p) => {
      op(p, 'gql:product-page').method = 'POST';
    }, /the edge does not cache POST; ProductPage needs method: GET/);
    expectWarning((p) => {
      delete op(p, 'gql:product-page').cache![0]!.reason;
    }, /operations\[0\]\.cache\[0\]\.ttl: ProductPage: st:edge-cache ttl 600 s overrides the derived 30 s \(limited by Product\.stock\); add reason/);
    expectWarning((p) => {
      delete field(p, 'sch:gql-query', 'product').cache_control;
    }, /ProductPage: st:edge-cache ttl 600 s is set on a response that cannot be cached \(cannot be cached: Query\.product has no cache hint/);
    expectWarning((p) => {
      op(p, 'gql:cart-summary').cache!.push({ at: 'st:edge-cache' });
    }, /CartSummary cannot be cached at the edge: Query\.cart is private/);
    const entity = check((p) => {
      op(p, 'gql:cart-summary').cache!.push({ at: 'st:entity-cache' });
    });
    expect(
      has(entity.warnings, /cannot be cached at the gateway/),
      'an entity cache keeps private data per scope',
    ).toBe(false);
  });

  it('19. a step on an operation calls the gateway from a service; purges need write access', () => {
    expectError((p) => {
      step(p, 'flow:browse', 'flow:browse#open').to = 'svc:product-graph';
    }, /flows\[0\]\.steps\[0\]\.to: via gql:product-page is answered by graph:shop's gateway svc:gateway/);
    expectError((p) => {
      step(p, 'flow:browse', 'flow:browse#open').from = 'st:catalog-db';
    }, /"from" must be the service that sends the operation/);
    expectWarning((p) => {
      step(p, 'flow:browse', 'flow:browse#open').reads = ['sch:price'];
    }, /calls gql:product-page, whose reads are derived/);
    expectWarning((p) => {
      byId(p.stores, 'st:edge-cache').access = [];
    }, /draft: svc:purger \(the acting service\) purges st:edge-cache, but only its owner \(svc:gateway\)/);
    expectWarning((p) => {
      step(p, 'flow:price-purge', 'flow:price-purge#purge').purges = ['st:catalog-db'];
    }, /purges st:catalog-db, a database/);
  });

  it('21. the reads behind the fan-out are checked per performing service', () => {
    expectWarning((p) => {
      byId(p.stores, 'st:pricing-db').owner = 'svc:product-graph';
    }, /draft: svc:pricing-api reads sch:price#amount_cents \(for sch:gql-product#price\) behind gql:product-page/);
    expectWarning((p) => {
      byId(p.changes, 'chg:price-expand').ops.pop();
    }, /^flows\[0\]\.steps\[0\]\.via: draft: svc:pricing-v2-graph reads st:price-redis \(for sch:gql-product#price\) behind gql:product-page/);
    const strict = check((p) => {
      Object.assign(p.meta, { status: 'review' });
      byId(p.stores, 'st:pricing-db').owner = 'svc:product-graph';
    });
    expect(
      has(strict.errors, /svc:pricing-api reads sch:price#amount_cents/),
      'an error once the plan is out of draft',
    ).toBe(true);
  });

  it('22. retired subgraphs, reads of graph types, who empties a cache, usage, gateway endpoints', () => {
    expectWarning((p) => {
      pushChange(p, { deprecate: 'sg:inventory' });
    }, /Product\.stock is still resolved by sg:inventory, which changes\[4\]\.ops\[0\] deprecates/);
    expectError((p) => {
      field(p, 'sch:gql-product', 'stock').reads = ['sch:gql-stock#available'];
    }, /Product\.stock reads sch:gql-stock#available, a graph type/);
    expectWarning((p) => {
      byId(p.messages, 'msg:price-published').consumers = [];
    }, /stores\[5\]\.invalidated_by\[0\]: st:edge-cache says msg:price-published purges it, but neither its owner \(svc:gateway\) nor a service with write access consumes msg:price-published/);
    expectWarning((p) => {
      delete step(p, 'flow:price-purge', 'flow:price-purge#purge').purges;
    }, /st:edge-cache says msg:price-published purges it, but no flow step that hears msg:price-published purges it/);
    expectWarning((p) => {
      pushChange(p, { deprecate: 'sch:gql-product#stock' });
    }, /changes\[4\]\.ops\[0\]\.deprecate: sch:gql-product#stock is deprecated with no usage evidence/);
    expect(has(check().warnings, /usage evidence/), 'leadTimeDays carries usage').toBe(false);
    expectWarning((p) => {
      byId(p.interfaces, 'if:graph').endpoints = [
        { id: 'api:graph-product', sig: 'POST /graphql' },
      ];
    }, /if:graph is the GraphQL interface of graph:shop's gateway but lists endpoints; model them as operations/);
  });
});

describe('review fixes: invalidators and composition', () => {
  it('M2: invalidators separate the events heard upstream of a purging step; check 22 warns per message', () => {
    const inv = invalidators(asIsOf(shop()), 'st:edge-cache');
    expect(inv.fromSteps).toEqual(['msg:price-published']);
    expect(inv.shortcut).toEqual(['msg:price-published']);
    expectWarning((p) => {
      byId(p.stores, 'st:edge-cache').invalidated_by!.push('msg:price-retired');
      p.messages!.push({
        id: 'msg:price-retired',
        name: 'price.retired',
        topic: 'st:price-topic',
        payload: 'sch:price-published',
        producer: 'svc:pricing-api',
        consumers: ['svc:purger'],
      });
    }, /st:edge-cache says msg:price-retired purges it, but no flow step that hears msg:price-retired purges it/);
    expect(has(check().warnings, /purges it/), 'the shipped message has a purging step').toBe(
      false,
    );
  });

  it('M3: a @provides the providing subgraph already satisfies is redundant; a value type needs its owner next to the field', () => {
    expectWarning((p) => {
      Object.assign(field(p, 'sch:gql-product', 'name'), {
        subgraphs: ['sg:product', 'sg:search'],
        shareable: true,
      });
    }, /redundant @provides: sg:search already resolves Product\.name everywhere/);
    expectWarning((p) => {
      for (const f of byId(p.schemas, 'sch:gql-money').fields!) f.subgraphs = ['sg:pricing'];
    }, /Money is returned by Cart\.subtotal \(sg:cart\) but amount, currency are resolved by sg:pricing/);
  });

  it('m2: a TTL on a response that cannot be cached warns for POST at a gateway cache too', () => {
    expectWarning((p) => {
      const o = byId(p.operations, 'gql:product-page');
      o.method = 'POST';
      o.cache = [{ at: 'st:entity-cache', ttl: 30 }];
    }, /ProductPage: st:entity-cache ttl 30 s is set on a response that cannot be cached/);
  });
});
