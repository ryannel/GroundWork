// Acme's model of today: its story, its words, its flows and journeys, and what each system offers and keeps.
// Every list is in the order the store reads it back: flows by file name, contracts by domain then system.
import type {
  Concept,
  Flow,
  Interaction,
  Source,
  Stage,
  UserJourney,
} from '@/domain/plan/plan.generated';
import {
  type Attribution,
  type CodeSource,
  type DomainLanguage,
  type KeyTerms,
  permalinkOf,
  type Scan,
  type SystemContracts,
  type WorkspaceModel,
} from '@/domain/workspace-model';

/** Where the cited facts live in Acme's repos. */
export const ACME_SOURCES = {
  products: {
    repo: 'acme/products',
    path: 'cmd/products/main.go',
    commit: '4f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
    lines: [12, 80],
    symbol: 'main',
  },
  ordersRest: {
    repo: 'acme/ordering',
    path: 'src/main/kotlin/orders/OrderController.kt',
    commit: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    lines: [20, 140],
    symbol: 'OrderController',
  },
  ordersCreate: {
    repo: 'acme/ordering',
    path: 'src/main/kotlin/orders/OrderController.kt',
    commit: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    lines: [34, 61],
    symbol: 'OrderController.create',
  },
} as const satisfies Readonly<Record<string, CodeSource>>;

/** A code source as the model holds it: a permalink, labelled with its symbol. */
const citeOf = (source: CodeSource): Source => {
  const label = source.label ?? source.symbol;
  return {
    url: permalinkOf(source),
    ...(label === undefined ? {} : { label }),
    ...(source.note === undefined ? {} : { note: source.note }),
  };
};

const EMPTY_CONTRACTS: Omit<SystemContracts, 'system'> = {
  components: [],
  stores: [],
  interfaces: [],
  schemas: [],
  messages: [],
  screens: [],
  graphs: [],
  subgraphs: [],
  operations: [],
};

const contractsOf = (
  system: string,
  parts: Partial<Omit<SystemContracts, 'system'>> = {},
): SystemContracts => ({ system, ...EMPTY_CONTRACTS, ...parts });

function contracts(): SystemContracts[] {
  return [
    contractsOf('products', {
      components: [
        {
          id: 'svc:products',
          summary: 'Owns the product record and announces every change on `product.changed`.',
          sources: [citeOf(ACME_SOURCES.products)],
        },
      ],
      stores: [
        {
          id: 'st:products-db',
          name: 'products-db',
          kind: 'database',
          tech: 'Postgres 16',
          owner: 'svc:products',
          does: 'Products and their details',
        },
      ],
      interfaces: [
        {
          id: 'if:products-rest',
          service: 'svc:products',
          protocol: 'rest',
          endpoints: [
            {
              id: 'api:products-get',
              sig: 'GET /products/{sku}',
              response: 'sch:product',
              idempotent: true,
            },
            {
              id: 'api:products-update',
              sig: 'PUT /products/{sku}',
              request: 'sch:product',
              response: 'sch:product',
              auth: 'staff SSO',
              idempotent: true,
            },
          ],
        },
      ],
      schemas: [
        {
          id: 'sch:product',
          name: 'Product',
          kind: 'record',
          store: 'st:products-db',
          fields: [
            { name: 'sku', type: 'string', required: true, key: true },
            { name: 'name', type: 'string', required: true },
            { name: 'price_cents', type: 'int', required: true },
          ],
        },
        {
          id: 'sch:product-changed-v1',
          name: 'product.changed v1',
          kind: 'payload',
          fields: [{ name: 'sku', type: 'string', required: true }],
        },
      ],
      messages: [
        {
          id: 'msg:product-changed',
          name: 'product.changed',
          version: 'v1',
          topic: 'st:product-events',
          payload: 'sch:product-changed-v1',
          producer: 'svc:products',
          consumers: ['svc:search-indexer'],
          key: 'sku',
        },
      ],
    }),
    contractsOf('search', {
      stores: [
        {
          id: 'st:search-index',
          name: 'search-index',
          kind: 'database',
          tech: 'OpenSearch',
          owner: 'svc:search-indexer',
          access: [{ svc: 'svc:search-api', mode: 'read' }],
        },
      ],
      interfaces: [
        {
          id: 'if:search-rest',
          service: 'svc:search-api',
          protocol: 'rest',
          endpoints: [
            {
              id: 'api:search-query',
              sig: 'GET /search?q={words}',
              response: 'sch:search-doc',
              idempotent: true,
            },
          ],
        },
      ],
      schemas: [
        {
          id: 'sch:search-doc',
          name: 'SearchDoc',
          kind: 'record',
          store: 'st:search-index',
          fields: [
            { name: 'sku', type: 'string', required: true, key: true },
            { name: 'words', type: 'string' },
          ],
        },
      ],
    }),
    contractsOf('ordering', orderingContracts()),
    contractsOf('payments', {
      interfaces: [
        {
          id: 'if:payments-rest',
          service: 'svc:payments',
          protocol: 'rest',
          endpoints: [
            {
              id: 'api:payments-charge',
              sig: 'POST /charges',
              auth: 'service token',
              idempotent: true,
              errors: [{ status: 402, code: 'declined', when: 'The card is declined' }],
            },
          ],
        },
        {
          id: 'if:card-provider',
          service: 'svc:card-provider',
          protocol: 'https',
          endpoints: [{ id: 'api:card-charge', sig: 'POST /v1/charges' }],
        },
      ],
    }),
    contractsOf('accounts'),
    contractsOf('shop', shopContracts()),
  ];
}

function orderingContracts(): Partial<SystemContracts> {
  return {
    stores: [
      {
        id: 'st:orders-db',
        name: 'orders-db',
        kind: 'database',
        tech: 'Postgres 16',
        owner: 'svc:order-api',
        does: 'Orders and their lines',
      },
      {
        id: 'st:order-events',
        name: 'order.events',
        kind: 'topic',
        tech: 'Kafka',
        owner: 'svc:order-api',
      },
    ],
    interfaces: [
      {
        id: 'if:orders-rest',
        service: 'svc:order-api',
        protocol: 'rest',
        sources: [citeOf(ACME_SOURCES.ordersRest)],
        endpoints: [
          {
            id: 'api:orders-create',
            sig: 'POST /orders',
            response: 'sch:order',
            auth: 'service token',
            idempotent: true,
            sources: [citeOf(ACME_SOURCES.ordersCreate)],
          },
          {
            id: 'api:orders-cancel',
            sig: 'POST /orders/{id}/cancel',
            response: 'sch:order',
            auth: 'staff SSO',
            idempotent: true,
          },
        ],
      },
    ],
    schemas: [
      {
        id: 'sch:order',
        name: 'Order',
        kind: 'record',
        store: 'st:orders-db',
        fields: [
          { name: 'id', type: 'uuid', required: true, key: true },
          { name: 'status', type: 'enum(placed, paid, cancelled)', required: true },
          { name: 'total_cents', type: 'int', required: true },
        ],
      },
      {
        id: 'sch:order-placed-v1',
        name: 'order.placed v1',
        kind: 'payload',
        fields: [{ name: 'order_id', type: 'uuid', required: true }],
      },
    ],
    messages: [
      {
        id: 'msg:order-placed',
        name: 'order.placed',
        version: 'v1',
        topic: 'st:order-events',
        payload: 'sch:order-placed-v1',
        producer: 'svc:order-api',
        consumers: ['svc:order-mailer'],
        key: 'order_id',
      },
    ],
  };
}

function shopContracts(): Partial<SystemContracts> {
  return {
    interfaces: [
      {
        id: 'if:shop-bff',
        service: 'svc:shop-bff',
        protocol: 'rest',
        endpoints: [{ id: 'api:bff-place-order', sig: 'POST /api/orders', response: 'sch:order' }],
      },
    ],
    screens: [
      {
        id: 'scr:product-page',
        name: 'Product page',
        service: 'svc:shop-web',
        kind: 'page',
        route: '/p/{sku}',
        image: 'assets/product-page.png',
        regions: [{ id: 'scr:product-page#buy', name: 'Buy button', reads: ['sch:product'] }],
      },
      {
        id: 'scr:basket',
        name: 'Basket',
        service: 'svc:shop-web',
        kind: 'page',
        route: '/basket',
        image: 'assets/basket.png',
      },
      {
        id: 'scr:confirmation',
        name: 'Order confirmation',
        service: 'svc:shop-web',
        kind: 'page',
        route: '/orders/{id}',
        image: 'assets/confirmation.png',
      },
    ],
  };
}

function flows(): Flow[] {
  return [
    {
      id: 'flow:cancel-order',
      name: 'Cancel an order',
      actor: 'Order clerk',
      trigger: 'A customer asks for their order to be cancelled.',
      steps: [
        {
          id: 'flow:cancel-order#cancel',
          from: 'svc:order-desk',
          to: 'svc:order-api',
          via: 'api:orders-cancel',
          action: 'Cancel the order',
          writes: ['sch:order#status'],
        },
      ],
    },
    {
      id: 'flow:place-order',
      name: 'Place an order',
      actor: 'Customer',
      trigger: 'The customer presses **Place order** on the basket.',
      outcome: 'The order is paid for and the customer is emailed.',
      steps: [
        {
          id: 'flow:place-order#submit',
          from: 'svc:shop-web',
          to: 'svc:shop-bff',
          via: 'api:bff-place-order',
          action: 'Send the basket',
          screen: 'scr:basket',
        },
        {
          id: 'flow:place-order#create',
          from: 'svc:shop-bff',
          to: 'svc:order-api',
          via: 'api:orders-create',
          action: 'Create the order',
          writes: ['sch:order'],
        },
        {
          id: 'flow:place-order#charge',
          from: 'svc:order-api',
          to: 'svc:payments',
          via: 'api:payments-charge',
          action: 'Take payment',
          fails: 'A declined card leaves the order unpaid and the customer is asked to try again.',
        },
        {
          id: 'flow:place-order#card',
          from: 'svc:payments',
          to: 'svc:card-provider',
          via: 'api:card-charge',
          action: 'Charge the card',
        },
        {
          id: 'flow:place-order#publish',
          from: 'svc:order-api',
          to: 'st:order-events',
          via: 'msg:order-placed',
          action: 'Announce the order',
          reads: ['sch:order'],
        },
        {
          id: 'flow:place-order#email',
          from: 'st:order-events',
          to: 'svc:order-mailer',
          via: 'msg:order-placed',
          action: 'Email the confirmation',
        },
      ],
    },
    {
      id: 'flow:publish-product',
      name: 'Publish a product',
      actor: 'Merchandiser',
      trigger: 'A merchandiser saves a product.',
      outcome: 'The product can be found by search.',
      steps: [
        {
          id: 'flow:publish-product#save',
          from: 'svc:product-admin',
          to: 'svc:products',
          via: 'api:products-update',
          action: 'Save the product',
          writes: ['sch:product'],
        },
        {
          id: 'flow:publish-product#announce',
          from: 'svc:products',
          to: 'st:product-events',
          via: 'msg:product-changed',
          action: 'Announce the change',
        },
        {
          id: 'flow:publish-product#index',
          from: 'st:product-events',
          to: 'svc:search-indexer',
          via: 'msg:product-changed',
          action: 'Index the product',
          writes: ['sch:search-doc'],
        },
      ],
    },
  ];
}

function interactions(): Interaction[] {
  return [
    {
      id: 'ui:add-to-basket',
      name: 'Add to basket',
      from: ['scr:product-page#buy'],
      to: 'scr:basket',
      trigger: 'click',
      effect: 'navigate',
    },
    {
      id: 'ui:place-order',
      name: 'Place order',
      from: ['scr:basket'],
      to: 'scr:confirmation',
      trigger: 'submit',
      effect: 'navigate',
      supporting_steps: ['flow:place-order#submit', 'flow:place-order#create'],
    },
  ];
}

const journeys = (): UserJourney[] => [
  {
    id: 'uj:buy',
    name: 'Buy a product',
    actor: 'Customer',
    interactions: ['ui:add-to-basket', 'ui:place-order'],
  },
];

function storyConcepts(): Concept[] {
  return [
    {
      id: 'con:product',
      name: 'Product',
      terms: ['product', 'item'],
      means: 'Something Acme sells, known by its SKU.',
      born_in: 'svc:products',
    },
  ];
}

function stages(): Stage[] {
  return [
    {
      id: 'stage:publish',
      name: 'Publish',
      summary: 'A product is saved and indexed.',
      services: [{ svc: 'svc:products' }, { svc: 'svc:search-indexer', from: ['svc:products'] }],
      flows: ['flow:publish-product'],
    },
    {
      id: 'stage:buy',
      name: 'Buy',
      summary: 'The customer orders and pays.',
      services: [
        { svc: 'svc:shop-web' },
        { svc: 'svc:shop-bff', from: ['svc:shop-web'] },
        { svc: 'svc:accounts', from: ['svc:shop-bff'] },
        { svc: 'svc:order-api' },
        { svc: 'svc:payments' },
      ],
      flows: ['flow:place-order', 'flow:cancel-order'],
    },
  ];
}

function languages(): DomainLanguage[] {
  return [
    {
      domain: 'orders',
      summary: 'An **order** is what a customer buys in one go; a **payment** settles it.',
      concepts: [
        {
          id: 'con:order',
          name: 'Order',
          terms: ['order', 'purchase'],
          means: 'What a customer buys in one go. Placed once, paid once.',
          born_in: 'svc:order-api',
          relates: [{ to: 'con:payment', as: 'is settled by' }],
          aka: [{ in: 'svc:shop-bff', as: 'Purchase', at: 'sch:order' }],
        },
        {
          id: 'con:order-line',
          name: 'Order line',
          terms: ['line'],
          means: 'One product and its quantity on an order.',
          born_in: 'svc:order-api',
          part_of: 'con:order',
        },
        {
          id: 'con:payment',
          name: 'Payment',
          terms: ['charge'],
          means: 'Money taken for an order.',
          born_in: 'svc:payments',
        },
      ],
    },
  ];
}

function keyTerms(): KeyTerms {
  return {
    summary: 'The words Acme agrees on.',
    source: { title: 'Acme glossary', url: null, status: 'agreed' },
    groups: [{ id: 'selling', name: 'Selling' }],
    terms: [
      {
        id: 'term:order',
        name: 'Order',
        group: 'selling',
        aliases: ['purchase'],
        means: 'Everything a customer buys at one checkout.',
        examples: [{ context: 'company', analogy: null, sentence: 'The order was paid by card.' }],
        relates: [],
        anchors: [
          { to: 'con:order', fit: 'same', note: null },
          { to: 'sys:ordering', fit: 'lives-in', note: null },
        ],
      },
    ],
  };
}

const scans = (): Scan[] => [
  {
    repo: 'acme/ordering',
    branch: 'main',
    head: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    scannedAt: '2026-09-30T10:00:00.000Z',
    scanner: 'groundwork-explore',
    files: { 'src/main/kotlin/orders/OrderController.kt': '1a2b3c4d' },
    facts: 9,
  },
];

const said = (origin: Attribution['origin'], ids: readonly string[]): [string, Attribution][] =>
  ids.map((id) => [id, { origin, sources: [] }]);

const idsOf = (entries: readonly { readonly id: string }[]): string[] =>
  entries.map(({ id }) => id);

/** Who said each fact: everything a scan read is extracted, the rest curated; three facts cite code. */
function attributionOf(
  parts: Omit<WorkspaceModel, 'attribution' | 'scans'>,
): Record<string, Attribution> {
  const extracted = parts.contracts.flatMap((each) => [
    ...idsOf(each.components),
    ...idsOf(each.stores),
    ...idsOf(each.interfaces),
    ...idsOf(each.schemas),
    ...idsOf(each.messages),
    ...idsOf(each.screens),
  ]);
  const curated = [
    ...idsOf(parts.story.concepts),
    ...idsOf(parts.story.stages),
    ...parts.languages.flatMap(({ concepts }) => idsOf(concepts)),
    ...idsOf(parts.flows),
    ...idsOf(parts.journeys),
    ...idsOf(parts.interactions),
  ];
  const cited: [string, Attribution][] = [
    ['svc:products', { origin: 'extracted', sources: [ACME_SOURCES.products] }],
    ['if:orders-rest', { origin: 'extracted', sources: [ACME_SOURCES.ordersRest] }],
    ['api:orders-create', { origin: 'extracted', sources: [ACME_SOURCES.ordersCreate] }],
  ];
  return Object.fromEntries([
    ...said('extracted', extracted),
    ...said('curated', curated),
    ...cited,
  ]);
}

/** A fresh copy of Acme's model of today every call. */
export function acmeModel(): WorkspaceModel {
  const parts = {
    story: {
      summary:
        'A **product** is published in the catalogue and found by search. A customer puts it in a basket, ' +
        'places an **order** and pays; the order is announced and the customer is emailed.',
      concepts: storyConcepts(),
      stages: stages(),
    },
    languages: languages(),
    keyTerms: keyTerms(),
    flows: flows(),
    journeys: journeys(),
    interactions: interactions(),
    contracts: contracts(),
  };
  return { ...parts, attribution: attributionOf(parts), scans: scans() };
}
