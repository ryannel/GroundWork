import { describe, expect, it, vi } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { migrateCatalogues } from './catalogues';
import { migrationCitations } from './citations';
import { migrationReview } from './review';
import { migrateWorkspace } from './workspace';

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

it('preserves authored wrapped identity, title, actor, summary and repeated journey order with only resolved flow support', async () => {
  const review = migrationReview();
  const folder = 'domains/sales/systems/shop';
  const citations = migrationCitations([], review, 'sys:shop');
  const scopes = [
    { folder, citations, contracts: { screens: [{ id: 'scr:shop', service: 'app:shop' }] } },
  ];
  const sourceText =
    'journey:\n  id: uj:authored-buy\ninteractions:\n  - id: ui:buy\n    supporting_steps: [flow:valid#first, flow:valid#missing]\n';
  const definitions = [
    { id: 'ui:review', from: ['scr:shop'], trigger: 'click' },
    {
      id: 'ui:buy',
      from: ['scr:shop'],
      trigger: 'submit',
      supporting_steps: ['flow:valid#first', 'flow:valid#missing', 'flow:valid#second'],
    },
    {
      id: 'ui:unused',
      from: ['scr:shop'],
      trigger: 'click',
      supporting_steps: ['flow:unused#first'],
    },
  ];
  const files = migrateCatalogues(
    [
      {
        path: 'workspace.yaml',
        text: '',
        value: { actors: [{ id: 'actor:customer', name: 'Customer' }] },
      },
      {
        path: 'journeys/old-file-slug.yaml',
        text: sourceText,
        value: {
          journey: {
            id: 'uj:authored-buy',
            name: 'Buy a product',
            actor: 'Customer',
            summary: 'The full recorded summary.',
            interactions: ['ui:buy', 'ui:review', 'ui:buy'],
          },
          interactions: definitions,
        },
      },
      {
        path: 'flows/valid.yaml',
        text: '',
        value: { id: 'flow:valid', steps: [{ id: 'flow:valid#first' }, { id: 'second' }] },
      },
      {
        path: 'flows/unused.yaml',
        text: '',
        value: { id: 'flow:unused', steps: [{ id: 'flow:unused#first' }] },
      },
    ],
    scopes,
    new Map([[`${folder}/contracts.yaml`, {}]]),
    review,
  );
  const native = files.find((file) => file.definition === 'JourneyFile')?.value;
  const check = await modelValidator('workspace', 'JourneyFile');
  expect(check(native), JSON.stringify(check.errors)).toBe(true);
  expect(native).toEqual({
    id: 'jny:authored-buy',
    name: 'Buy a product',
    actor: 'actor:customer',
    summary: 'The full recorded summary.',
    interactions: ['ui:buy', 'ui:review', 'ui:buy'],
    flows: ['flow:valid'],
  });
  const receipt = review.rows()['source-notes']?.[0];
  expect(receipt).toMatchObject({
    sourceText,
    sourcePath: 'journeys/old-file-slug.yaml',
    declaredActor: 'Customer',
    supportingSteps: [
      {
        interaction: 'ui:buy',
        steps: ['flow:valid#first', 'flow:valid#missing', 'flow:valid#second'],
      },
      { interaction: 'ui:unused', steps: ['flow:unused#first'] },
    ],
    unresolved: ['flow:valid#missing', 'flow:valid#missing'],
  });
  expect(review.pending('placements')).toBe(0);
});

it('emits the old authored journey id as an alias to the canonical declared identity', () => {
  const result = migrateWorkspace(
    [
      {
        path: 'workspace.yaml',
        text: '',
        value: { id: 'shop', name: 'Shop', actors: [{ id: 'actor:customer', name: 'Customer' }] },
      },
      {
        path: 'journeys/old-file-slug.yaml',
        text: '',
        value: {
          journey: {
            id: 'uj:authored-buy',
            name: 'Buy a product',
            actor: 'Customer',
            interactions: [],
          },
          interactions: [],
        },
      },
    ],
    migrationReview(),
  );
  expect(result.identities.replacements.get('uj:authored-buy')).toBe('jny:authored-buy');
  expect(result.files.get('aliases.yaml')?.value).toHaveProperty(
    'uj:authored-buy.to',
    'jny:authored-buy',
  );
  expect(result.files.get('journeys/old-file-slug.yaml')?.value).toEqual({
    id: 'jny:authored-buy',
    name: 'Buy a product',
    actor: 'actor:customer',
    interactions: [],
  });
});

it('keeps an ambiguous authored actor visible for placement review without creating an actor identity', () => {
  const review = migrationReview();
  const files = migrateCatalogues(
    [
      {
        path: 'workspace.yaml',
        text: '',
        value: {
          actors: [
            { id: 'actor:first', name: 'Customer' },
            { id: 'actor:second', name: 'Customer' },
          ],
        },
      },
      {
        path: 'journeys/buy.yaml',
        text: 'journey:\n  actor: Customer\n',
        value: {
          journey: { id: 'uj:buy', name: 'Buy', actor: 'Customer', interactions: [] },
          interactions: [],
        },
      },
    ],
    [],
    new Map(),
    review,
  );
  expect(files[0]?.value).not.toHaveProperty('actor');
  expect(review.rows().placements?.[0]).toMatchObject({
    sourcePath: 'journeys/buy.yaml',
    actor: 'Customer',
    reason: 'No unique declared actor matches the recorded journey actor.',
  });
  expect(review.pending('placements')).toBe(1);
});
