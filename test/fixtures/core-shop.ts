import { byId, shop } from '@/../test/federation-kit';
import type { Change, Plan, Schema } from '@/domain/plan/plan.generated';

/**
 * The federated shop with what the plan-core tests print: a Customer entity, an image the search subgraph
 * provides, arguments on search and the delivery promise, and a rollout on the move of price to Pricing v2.
 */
export function coreShop(): Plan {
  const p = shop();
  const product = byId<Schema>(p.schemas, 'sch:gql-product');
  const fields = product.fields ?? [];
  const at = fields.findIndex((f) => f.name === 'name') + 1;
  product.fields = [
    ...fields.slice(0, at),
    { name: 'imageUrl', type: 'String', subgraphs: ['sg:product'] },
    ...fields.slice(at),
  ];
  const search = byId<Schema>(p.schemas, 'sch:gql-query').fields?.find((f) => f.name === 'search');
  if (search !== undefined) {
    search.args = 'q: String!, first: Int';
    search.provides = ['sch:gql-product#name', 'sch:gql-product#imageUrl'];
  }
  p.schemas = [
    ...(p.schemas ?? []),
    {
      id: 'sch:gql-customer',
      name: 'Customer',
      kind: 'graph-type',
      graph: 'graph:shop',
      keys: [{ fields: ['id'], in: ['sg:reviews'] }],
      fields: [
        { name: 'id', type: 'ID!', subgraphs: ['sg:reviews'] },
        { name: 'displayName', type: 'String', subgraphs: ['sg:reviews'] },
      ],
    },
  ];
  const promise = byId<Change>(p.changes, 'chg:promise');
  for (const op of promise.ops) {
    if ('add' in op && op.add === 'field' && 'value' in op) {
      const value = op.value as { name?: string; args?: string };
      if (value.name === 'deliveryPromise') value.args = 'region: Region!';
    }
  }
  byId<Change>(p.changes, 'chg:price-migrate').rollout = '10 % → 50 % → 100 %';
  return p;
}
