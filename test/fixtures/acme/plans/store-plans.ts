// Plans as the store finds them in Acme's folder: a small graph plan, earlier revisions of pause-orders, and
// what has happened to its work items. Write them with writeWorkspace beside acmeFiles().
import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import type { PlanOverlay } from '@/../test/plan-kit';
import type { Progress } from '@/domain/model/plan.generated';

/** An overlay that puts a GraphQL graph in front of the shop, so the product page reads products through it. */
export function productGraphOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'product-graph',
      title: 'Serve the product page from a graph',
      version: '0.1',
      date: '2026-05-25',
      status: 'draft',
      authors: ['Web'],
      repos: ['acme/products'],
    },
    problem: {
      summary: 'The shop calls [[svc:products]] for every product page.',
      why: 'One graph lets the product page ask for what it shows in one round trip.',
      goals: ['The product page reads products through the shop graph'],
    },
    changes: [
      {
        id: 'chg:shop-graph',
        title: 'Add the shop graph',
        why: 'The shop back end becomes the gateway for the product page.',
        ops: [
          {
            add: 'graph',
            value: { id: 'graph:shop', name: 'Shop graph', gateway: 'svc:shop-bff' },
          },
          {
            add: 'subgraph',
            value: {
              id: 'sg:products',
              name: 'Products subgraph',
              graph: 'graph:shop',
              service: 'svc:products',
              batching: 'dataloader',
            },
          },
          {
            add: 'schema',
            value: {
              id: 'sch:gql-query',
              name: 'Query',
              kind: 'graph-type',
              graph: 'graph:shop',
              root: 'query',
              fields: [
                { name: 'product', args: 'sku: ID!', type: 'Product', subgraphs: ['sg:products'] },
              ],
            },
          },
          {
            add: 'schema',
            value: {
              id: 'sch:gql-product',
              name: 'Product',
              kind: 'graph-type',
              graph: 'graph:shop',
              keys: [{ fields: ['sku'], in: ['sg:products'] }],
              fields: [
                { name: 'sku', type: 'ID!', reads: ['sch:product#sku'] },
                {
                  name: 'name',
                  type: 'String!',
                  subgraphs: ['sg:products'],
                  reads: ['sch:product#name'],
                },
              ],
            },
          },
          {
            add: 'operation',
            value: {
              id: 'gql:product-page',
              name: 'ProductPage',
              kind: 'query',
              graph: 'graph:shop',
              screens: ['scr:product-page#buy'],
              client: 'svc:shop-web',
              method: 'GET',
              persisted: 'apq',
              document: 'query ProductPage($sku: ID!) { product(sku: $sku) { sku name } }\n',
            },
          },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:product-page-query',
        level: 'contract',
        name: 'Product page query',
        proves: ['chg:shop-graph'],
        owner: 'team:web',
        env: 'ci',
      },
    ],
    work_items: [
      {
        id: 'wi:shop-graph',
        title: 'Shop graph',
        team: 'team:web',
        size: 'M',
        implements: ['chg:shop-graph'],
        verified_by: ['tst:product-page-query'],
        repo: 'acme/products',
      },
    ],
  };
}

/** pause-orders as it stood at an earlier version, as kept in plans/pause-orders/revisions/<version>.yaml. */
export function pauseOrdersAt(version: string): PlanOverlay {
  const overlay = pauseOrdersOverlay();
  return { ...overlay, meta: { ...overlay.meta, version } };
}

/** What has happened to pause-orders' work items, as plans/pause-orders/progress.yaml records it. */
export function pauseOrdersProgress(): Progress {
  return {
    events: [
      {
        at: '2026-05-20',
        subject: 'wi:pause-api',
        kind: 'work',
        state: 'in_progress',
        source: { kind: 'github', repo: 'acme/ordering', issue: 12 },
      },
      {
        at: '2026-05-21',
        subject: 'wi:desk-button',
        kind: 'commitment',
        state: 'accepted',
        promised_for: '2026-06-10',
        confidence: 'medium',
        said_by: 'Web',
        source: { kind: 'meeting', note: 'Planning' },
      },
      {
        at: '2026-05-21',
        subject: 'wi:desk-button',
        kind: 'work',
        state: 'not_started',
        source: { kind: 'github', url: 'https://github.com/acme/ordering/issues/13' },
      },
      {
        at: '2026-05-28T09:00:00Z',
        subject: 'wi:pause-api',
        kind: 'work',
        state: 'done',
        source: { kind: 'github', repo: 'acme/ordering', issue: 12 },
      },
      { at: '2026-05-29', subject: 'ms:pause', kind: 'note', note: 'Demoed to the clerks.' },
    ],
  };
}
