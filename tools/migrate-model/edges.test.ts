import { describe, expect, it, vi } from 'vitest';

import { modelRecord } from '@/domain/workspace-model';
import { modelProblems } from '@/infrastructure/model-schema';

import { migrationCitations } from './citations';
import { reconcileEdges } from './edges';
import { migrationReview } from './review';

vi.mock(import('server-only'), () => ({}));
const cites = ['repo:src/order.ts#L1-20'];
function setup() {
  const review = migrationReview();
  const citations = migrationCitations([], review, 'sys:shop');
  const scopes = [
    {
      folder: 'shop',
      citations,
      source: {
        id: 'sys:shop',
        name: 'Shop',
        components: [
          {
            id: 'svc:shop',
            talks_to: [
              { to: 'svc:orders', via: 'api' },
              { to: 'svc:unknown', via: 'api' },
            ],
          },
        ],
      },
      contracts: {
        messages: [{ id: 'msg:ordered', topic: 'top:orders', producer: 'svc:shop', cites }],
        stores: [{ id: 'st:db', access: [{ svc: 'svc:shop', mode: 'readwrite' }], cites }],
      },
    },
    {
      folder: 'orders',
      citations,
      source: {
        id: 'sys:orders',
        name: 'Orders',
        components: [{ id: 'svc:orders' }, { id: 'top:orders' }, { id: 'st:db' }],
      },
      contracts: {
        interfaces: [{ id: 'if:orders', component: 'svc:orders', entries: [{ id: 'api:order' }] }],
      },
    },
  ];
  const systems = new Map([
    [
      'shop',
      {
        system: { id: 'sys:shop', name: 'Shop' },
        contracts: {},
        handlers: [
          {
            id: 'h:buy',
            component: 'svc:shop',
            on: 'api:buy',
            cites,
            steps: [
              { id: 'call-orders', call: 'api:order', cites },
              { id: 'read-db', read: 'sch:order', from: 'st:db', cites },
            ],
          },
        ],
      },
    ],
    ['orders', { system: { id: 'sys:orders', name: 'Orders' }, contracts: {}, handlers: [] }],
  ]);
  return { review, scopes, systems };
}
describe('edge reconciliation', () => {
  it('backs summaries with exact cited steps, retains uncovered contract facts and reviews weak summaries', async () => {
    const { review, scopes, systems } = setup();
    const result = reconcileEdges(scopes, systems, review).get('shop');
    expect(result).toMatchObject({
      connections: [{ to: 'sys:orders', says: 'api', backs: ['h:buy#call-orders'] }],
    });
    expect(result?.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'svc:shop', to: 'st:db', kind: 'write', cites }),
        expect.objectContaining({ from: 'svc:shop', to: 'msg:ordered', kind: 'publish', cites }),
      ]),
    );
    expect(result?.relationships).toHaveLength(2);
    await expect(modelProblems('workspace', 'SystemFile', result)).resolves.toEqual([]);
    expect(review.rows()['review-edges']).toHaveLength(1);
    expect(review.rows()['review-edges']?.[0]).toMatchObject({
      edge: { to: 'svc:unknown' },
      reason: 'No cited handler or contract backing.',
    });
  });
  it('keeps persistent relationship ids when the input order changes', () => {
    const { review, scopes, systems } = setup();
    const first = reconcileEdges(scopes, systems, review);
    const reversed = reconcileEdges(scopes.toReversed(), systems, migrationReview());
    expect(reversed.get('shop')).toEqual(first.get('shop'));
  });
});

it('backs a declared GraphQL client-to-gateway summary with its cited operation', () => {
  const fixture = setup();
  const scopes = fixture.scopes.map((scope) => ({
    ...scope,
    contracts: {
      ...scope.contracts,
      graphs: scope.folder === 'shop' ? [{ id: 'graph:shop', gateway: 'svc:orders' }] : [],
    },
  }));
  const systems = new Map(
    [...fixture.systems].map(([folder, system]) => [
      folder,
      {
        ...system,
        handlers: [],
        contracts:
          folder === 'shop'
            ? {
                operations: [
                  {
                    id: 'gql:order',
                    component: 'svc:shop',
                    graph: 'graph:shop',
                    document: 'ev:document',
                    cites,
                  },
                ],
              }
            : {},
      },
    ]),
  );
  const result = reconcileEdges(scopes, systems, fixture.review).get('shop');
  expect(result?.connections).toEqual([{ to: 'sys:orders', says: 'api', backs: ['gql:order'] }]);
});

it('applies edge dispositions only from exact accepted review rows', () => {
  const fixture = setup();
  const systems = new Map(
    [...fixture.systems].map(([folder, system]) => [folder, { ...system, handlers: [] }]),
  );
  reconcileEdges(fixture.scopes, systems, fixture.review);
  const rows = (fixture.review.rows()['review-edges'] ?? []).filter(
    (row) => modelRecord(row.edge)?.to === 'svc:orders',
  );
  const relationship = {
    id: 'rel:reviewed',
    from: 'svc:shop',
    to: 'svc:orders',
    kind: 'call',
    says: 'Calls the documented supplier',
    reason: 'Only its client declaration is recorded',
    cites,
  };
  const connection = { to: 'sys:orders', says: 'Reviewed supplier call', backs: ['rel:reviewed'] };
  const unaccepted = migrationReview([rows.map((row) => ({ ...row, relationship, connection }))]);
  expect(
    reconcileEdges(fixture.scopes, systems, unaccepted).get('shop')?.relationships,
  ).not.toContainEqual(relationship);
  const accepted = migrationReview([
    rows.map((row) => ({ ...row, status: 'accepted', relationship, connection })),
  ]);
  const result = reconcileEdges(fixture.scopes, systems, accepted).get('shop');
  expect(result?.relationships).toContainEqual(relationship);
  expect(result?.connections).toContainEqual(connection);
});
