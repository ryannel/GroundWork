import { describe, expect, it } from 'vitest';

import { explorerManifestFixture } from '@/../test/service-explorer-kit';
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
  it('links service code from its own recorded sources without needing an explorer catalogue', () => {
    const { workspace } = acme();
    const selected = workspace.domains
      .flatMap((domain) => domain.systems)
      .find((system) => system.id === 'shop')!.components[0]!;
    const options = {
      workspace,
      landscape,
      area: 'sell',
      explorer: null,
    };
    const source = { repo: 'acme/shop', path: 'service.ts', commit: 'abc' };
    const attribution = {
      [selected.id]: { origin: 'extracted' as const, sources: [source, source] },
    };
    const component = areaViewOf({ ...options, attribution })
      ?.systems.flatMap((system) => system.components)
      .find((item) => item.id === selected.id);
    expect(component?.repository).toEqual({
      name: 'acme/shop',
      href: 'https://github.com/acme/shop',
    });
    const ambiguous = {
      [selected.id]: {
        ...attribution[selected.id]!,
        sources: [source, { ...source, repo: 'acme/another' }],
      },
    };
    expect(
      areaViewOf({ ...options, attribution: ambiguous })
        ?.systems.flatMap((system) => system.components)
        .find((item) => item.id === selected.id)?.repository,
    ).toBeNull();
  });

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

it('transports the authored area and joins actual endpoints, callers, resources and dependencies', () => {
  const { workspace, today } = acme();
  const view = areaViewOf({
    workspace,
    model: today.model,
    landscape,
    area: 'sell',
    explorer: null,
  });
  expect(view).toMatchObject({
    workspace: { id: 'acme', name: 'Acme', href: '/acme/' },
    area: landscape.areas[0],
    reviewed: '2026-10-26',
    scope: 'The mapped systems.',
    limitation: 'Partial.',
    relationships: landscape.details[0]!.relationships,
    collaborations: landscape.details[0]!.collaborations,
  });
  const products = view?.systems.find((system) => system.id === 'products');
  expect(products).toMatchObject({
    id: 'products',
    name: 'Products',
    purpose: 'Keeps every product and its details.',
    href: '/acme/catalogue/products/',
    resources: ['1 store', '1 topic'],
  });
  expect(products?.components.find((component) => component.id === 'svc:products')).toMatchObject({
    id: 'svc:products',
    name: 'Products API',
    kind: 'service',
    summary: 'Serves and stores product details',
    technology: 'Go',
    repository: null,
    explorer: null,
    dependencies: [],
    endpoints: [
      {
        id: 'api:products-get',
        signature: 'GET /products/{sku}',
        protocol: 'rest',
        summary: 'Purpose not described yet.',
        request: null,
        response: 'sch:product',
        callers: [],
        explorer: null,
      },
      {
        id: 'api:products-update',
        signature: 'PUT /products/{sku}',
        protocol: 'rest',
        summary: 'Purpose not described yet.',
        request: 'sch:product',
        response: 'sch:product',
        callers: [
          {
            id: 'svc:product-admin',
            name: 'Product admin',
            system: 'products',
            systemName: 'Products',
          },
        ],
        explorer: null,
      },
    ],
    resources: [
      {
        id: 'st:products-db',
        name: 'products-db',
        kind: 'store',
        technology: 'Postgres 16',
        use: 'Reads and writes',
        category: 'database',
      },
      {
        id: 'st:product-events',
        name: 'product.events',
        kind: 'topic',
        technology: 'Kafka',
        use: 'Publishes product.changed',
        category: 'topic',
      },
    ],
  });
  expect(
    products?.components.find((component) => component.id === 'svc:product-admin')?.dependencies,
  ).toEqual([
    {
      id: 'svc:products',
      name: 'Products API',
      system: 'products',
      systemName: 'Products',
      endpointId: 'api:products-update',
      endpoint: 'PUT /products/{sku}',
    },
  ]);
  expect(
    view?.systems
      .find((system) => system.id === 'shop')
      ?.components.find((component) => component.id === 'svc:shop-bff')?.dependencies,
  ).toEqual([
    {
      id: 'svc:order-api',
      name: 'Order API',
      system: 'ordering',
      systemName: 'Ordering',
      endpointId: 'api:orders-create',
      endpoint: 'POST /orders',
    },
  ]);
});

it('matches published endpoint links by verb and signature and keeps unpublished entries as gaps', () => {
  const { workspace, today } = acme();
  const base = explorerManifestFixture([]);
  const service = {
    ...base.services[0]!,
    id: 'products',
    repo: 'acme/products',
    entries: [
      { id: 'wrong', label: 'GET /unrelated', file: 'unrelated.json' },
      { id: 'get', label: ' get   /products/{SKU} ', file: 'get product.json' },
    ],
  };
  const explorer = { ...base, services: [service] };
  const component = areaViewOf({ workspace, model: today.model, landscape, area: 'sell', explorer })
    ?.systems.find((system) => system.id === 'products')
    ?.components.find((item) => item.id === 'svc:products');
  expect(component?.repository).toEqual({
    name: 'acme/products',
    href: 'https://github.com/acme/products',
  });
  expect(component?.explorer).toBe('/acme/explorer/?service=products');
  expect(component?.endpoints.map((endpoint) => endpoint.explorer)).toEqual([
    '/acme/explorer/?service=products&page=get%20product.json',
    null,
  ]);
});

it('keeps an area without details visible and skips missing systems and libraries', () => {
  const { workspace } = acme();
  expect(areaViewOf({ workspace, landscape, area: 'missing', explorer: null })).toBeNull();
  expect(areaViewOf({ workspace, landscape, area: 'fulfil', explorer: null })).toMatchObject({
    systems: [],
    relationships: [],
    collaborations: [],
    technicalRelationships: [],
  });
  const domain = workspace.domains[0]!;
  const system = domain.systems[0]!;
  const component = system.components[0]!;
  const augmented = {
    ...workspace,
    domains: [
      {
        ...domain,
        systems: [
          {
            ...system,
            components: [
              ...system.components,
              { ...component, id: 'lib:shared', type: 'library' as const },
            ],
          },
        ],
      },
    ],
  };
  const withMissing = {
    ...landscape,
    details: [{ ...landscape.details[0]!, systems: ['products', 'missing'] }],
  };
  const view = areaViewOf({
    workspace: augmented,
    landscape: withMissing,
    area: 'sell',
    explorer: null,
  });
  expect(view?.systems.map((item) => item.id)).toEqual(['products']);
  expect(view?.systems[0]?.components.map((item) => item.id)).toEqual([
    'svc:products',
    'svc:product-admin',
    'st:products-db',
    'st:product-events',
  ]);
});

it('retains a saved flow across recorded system boundaries without moving resources to their users', () => {
  const { workspace, today } = acme();
  const valueFlow = {
    title: 'Read products',
    summary: 'A saved resource exchange.',
    confidence: 'medium' as const,
    reasoning: 'Recorded access.',
    limitations: [],
    bands: [
      { id: 'read', title: 'Read', summary: '', nodes: [{ component: 'svc:shop-bff', column: 0 }] },
    ],
    connections: [
      {
        from: 'svc:shop-bff',
        to: 'st:products-db',
        kind: 'data' as const,
        label: 'Read products',
        evidence: ['svc:products'],
      },
    ],
    summaries: [
      {
        from: 'svc:shop-bff',
        to: 'st:product-events',
        kind: 'message' as const,
        label: 'Changes',
        evidence: [],
      },
    ],
  };
  const selected: AuthoredLandscape = {
    ...landscape,
    details: [{ ...landscape.details[0]!, systems: ['shop'], valueFlow }],
  };
  const options = {
    workspace,
    landscape: selected,
    area: 'sell',
    explorer: null,
    model: today.model,
  };
  const view = areaViewOf(options)!;
  expect(view.systems.map((system) => system.id)).toEqual(['shop', 'products']);
  expect(view.valueFlow).toEqual(valueFlow);
  expect(view.systems[0]?.components.some((component) => component.id === 'st:products-db')).toBe(
    false,
  );
  expect(view.systems[1]?.components).toContainEqual(
    expect.objectContaining({ id: 'st:products-db' }),
  );
  expect(selected.details[0]?.systems).toEqual(['shop']);
  expect(
    areaViewOf({ workspace, landscape: selected, area: 'sell', explorer: null })?.valueFlow,
  ).toBeUndefined();
  const unknown = {
    ...valueFlow,
    connections: [{ ...valueFlow.connections[0]!, to: 'st:unknown' }],
  };
  expect(
    areaViewOf({
      ...options,
      landscape: { ...selected, details: [{ ...selected.details[0]!, valueFlow: unknown }] },
    })?.valueFlow,
  ).toBeUndefined();
});
