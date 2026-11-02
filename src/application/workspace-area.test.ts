import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import type { AuthoredLandscape } from '@/domain/landscape';

import { areaViewOf } from './workspace-area';
import { areaLandscapeOf } from './workspace-landscape-areas';

const landscape: AuthoredLandscape = {
  label: 'Inferred',
  reviewed: '2026-10-26',
  scope: 'The mapped systems.',
  limitation: 'Partial.',
  areas: [
    {
      id: 'sell',
      name: 'Sell products',
      purpose: 'Make products available.',
      activities: ['Publish an offer'],
      boundary: 'Does not prove fulfilment.',
      confidence: 'medium',
      evidenceCount: 4,
    },
    {
      id: 'fulfil',
      name: 'Fulfil orders',
      purpose: 'Deliver accepted orders.',
      activities: ['Dispatch an order'],
      boundary: 'Does not prove receipt.',
      confidence: 'medium',
      evidenceCount: 3,
    },
  ],
  relationships: [
    { id: 'sold', from: 'sell', to: 'fulfil', label: 'Accepted order', kind: 'transition' },
  ],
  details: [
    {
      area: 'sell',
      systems: ['shop', 'products'],
      relationships: [
        {
          id: 'products',
          from: 'products',
          to: 'shop',
          label: 'Products',
          kind: 'api',
          detail: 'The current range.',
        },
      ],
      collaborations: [
        {
          id: 'publish',
          name: 'Publish a product',
          summary: 'The shop reads the range.',
          systems: ['products', 'shop'],
        },
      ],
    },
  ],
};

describe('area landscape', () => {
  it('keeps areas as links into the workspace and draws their major relationship', () => {
    const { workspace } = acme();
    const view = areaLandscapeOf(workspace, landscape);
    expect(view.nodes.map((node) => node.href)).toEqual([
      '/acme/areas/sell/',
      '/acme/areas/fulfil/',
    ]);
    expect(view.edges[0]).toMatchObject({ from: 'sell', to: 'fulfil', label: 'Accepted order' });
  });

  it('joins a selected area to independently modelled systems and components', () => {
    const { workspace } = acme();
    const view = areaViewOf({ workspace, landscape, area: 'sell', explorer: null });
    expect(view?.systems.map((system) => system.id)).toEqual(['shop', 'products']);
    expect(view?.systems[0]?.components.length).toBeGreaterThan(0);
    expect(view?.collaborations[0]?.systems).toEqual(['products', 'shop']);
  });
});

it('rejects an overview exchange that does not reuse a known core connection', () => {
  const { workspace, today } = acme();
  const connection = {
    from: 'svc:shop-bff',
    to: 'svc:products',
    kind: 'api' as const,
    label: 'Read products',
    evidence: ['svc:products'],
  };
  const valueFlow = {
    columns: [
      { system: 'products', column: 0 },
      { system: 'shop', column: 1 },
    ],
    title: 'Read products',
    summary: 'Use the range.',
    confidence: 'medium' as const,
    reasoning: 'Captured calls.',
    limitations: [],
    bands: [
      {
        id: 'read',
        title: 'Read',
        summary: '',
        nodes: [
          { component: 'svc:shop-bff', column: 0 },
          { component: 'svc:products', column: 1 },
        ],
      },
    ],
    connections: [connection],
    overview: [connection],
  };
  const withFlow = (value: typeof valueFlow): AuthoredLandscape => ({
    ...landscape,
    details: [{ ...landscape.details[0]!, valueFlow: value }],
  });
  expect(
    areaViewOf({
      workspace,
      model: today.model,
      landscape: withFlow(valueFlow),
      area: 'sell',
      explorer: null,
    })?.valueFlow,
  ).toBeDefined();
  const invented = {
    ...valueFlow,
    overview: [{ ...connection, from: connection.to, to: connection.from }],
  };
  expect(
    areaViewOf({
      workspace,
      model: today.model,
      landscape: withFlow(invented),
      area: 'sell',
      explorer: null,
    })?.valueFlow,
  ).toBeUndefined();
  for (const columns of [
    [{ system: 'unknown', column: 0 }],
    [
      { system: 'shop', column: 0 },
      { system: 'shop', column: 1 },
    ],
  ]) {
    expect(
      areaViewOf({
        workspace,
        model: today.model,
        landscape: withFlow({ ...valueFlow, columns }),
        area: 'sell',
        explorer: null,
      })?.valueFlow,
    ).toBeUndefined();
  }
});
