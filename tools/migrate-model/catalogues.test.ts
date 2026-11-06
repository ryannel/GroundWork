import { describe, expect, it, vi } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { migrateCatalogues } from './catalogues';
import { migrationCitations } from './citations';
import { migrationReview } from './review';

vi.mock(import('server-only'), () => ({}));

describe('migration of graphs and interactions', () => {
  it('keeps declared subgraph membership and explicit field signatures', async () => {
    const review = migrationReview();
    const citations = migrationCitations([], review, 'sys:orders');
    const folder = 'domains/sales/systems/orders';
    const scopes = [
      {
        folder,
        citations,
        contracts: {
          graphs: [{ id: 'graph:shop', name: 'Shop', gateway: 'svc:orders' }],
          subgraphs: [
            { id: 'sg:orders', graph: 'graph:shop', service: 'svc:orders', batching: 'dataloader' },
          ],
        },
      },
    ];
    const files = migrateCatalogues(
      [],
      scopes,
      new Map([
        [
          `${folder}/contracts.yaml`,
          {
            interfaces: [
              {
                id: 'if:orders',
                kind: 'graphql',
                component: 'svc:orders',
                entries: [{ id: 'api:order', sig: 'Query.order(id: ID!): Order' }],
              },
            ],
          },
        ],
      ]),
      review,
    );
    const graph = files.find((file) => file.definition === 'GraphFile');
    const check = await modelValidator('workspace', 'GraphFile');
    expect(check(graph?.value), JSON.stringify(check.errors)).toBe(true);
    expect(graph?.value).toMatchObject({
      subgraphs: [{ component: 'svc:orders', batching: 'dataloader' }],
    });
    expect(files.find((file) => file.definition === 'ContractsFile')?.value).toMatchObject({
      interfaces: [
        {
          subgraph: 'sg:orders',
          entries: [{ field: 'Query.order', signature: 'Query.order(id: ID!): Order' }],
        },
      ],
    });
  });
  it('places each existing interaction with its screen’s app and preserves its condition and result', async () => {
    const review = migrationReview();
    const citations = migrationCitations([], review, 'sys:shop');
    const folder = 'domains/sales/systems/shop';
    const scopes = [
      { folder, citations, contracts: { screens: [{ id: 'scr:shop', service: 'app:shop' }] } },
    ];
    const journey = {
      path: 'journeys/buy.yaml',
      text: '',
      value: {
        interactions: [
          {
            id: 'ui:buy',
            name: 'Buy',
            from: ['scr:shop'],
            to: 'scr:done',
            trigger: 'click',
            effect: 'navigate',
            condition: 'A basket exists',
            result: 'Shows confirmation',
          },
        ],
      },
    };
    const files = migrateCatalogues(
      [journey],
      scopes,
      new Map([[`${folder}/contracts.yaml`, {}]]),
      review,
    );
    const contracts = files.find((file) => file.definition === 'ContractsFile');
    const check = await modelValidator('workspace', 'ContractsFile');
    expect(check(contracts?.value), JSON.stringify(check.errors)).toBe(true);
    expect(modelList(modelRecord(contracts?.value)?.interactions)).toEqual([
      {
        id: 'ui:buy',
        component: 'app:shop',
        on: 'scr:shop',
        name: 'Buy',
        to: 'scr:done',
        action: 'click',
        effect: 'navigate',
        when: 'A basket exists',
        summary: 'Shows confirmation',
      },
    ]);
    expect(files.find((file) => file.definition === 'JourneyFile')?.value).toEqual({
      id: 'jny:buy',
      name: 'Buy',
      interactions: ['ui:buy'],
    });
    expect(review.pending('placements')).toBe(0);
  });
});
