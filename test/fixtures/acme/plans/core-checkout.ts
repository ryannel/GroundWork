// Acme's today with more to draw, and a plan on it that changes what a customer sees and does. Today gains the
// replies, screens and journeys the plan core reads (a product page, a basket, an email), a job, and a flow a
// System runs; the plan adds, removes, reorders and deprecates steps and flows and versions a message.
import { acmeModel } from '@/../test/fixtures/acme/model';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { type OnToday, planOnToday, type PlanOverlay } from '@/../test/plan-kit';
import { type SystemModel, systemModelOf } from '@/application/workspace-model';
import type { Flow, Interaction, Screen, UserJourney } from '@/domain/plan/plan.generated';
import type { SystemContracts, WorkspaceModel } from '@/domain/workspace-model';

const contractsOf = (model: WorkspaceModel, system: string): SystemContracts => {
  const found = model.contracts.find((c) => c.system === system);
  if (found === undefined) throw new Error(`no contracts for ${system}`);
  return found;
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const open = (c: SystemContracts): Mutable<SystemContracts> => c;

function paymentsToday(model: WorkspaceModel): void {
  const payments = open(contractsOf(model, 'payments'));
  payments.schemas = [
    ...payments.schemas,
    {
      id: 'sch:payment',
      name: 'Payment',
      kind: 'payload',
      fields: [
        { name: 'id', type: 'uuid', required: true },
        { name: 'status', type: 'enum(taken, declined)', required: true },
      ],
    },
  ];
  payments.interfaces = payments.interfaces.map((i) => ({
    ...i,
    endpoints: (i.endpoints ?? []).map((e) => ({ ...e, response: 'sch:payment' })),
  }));
}

const SHOP_SCREENS: Screen[] = [
  {
    id: 'scr:search-results',
    name: 'Search results',
    service: 'svc:shop-web',
    kind: 'page',
    route: '/search',
    image: 'assets/search-results.png',
  },
];

function shopToday(model: WorkspaceModel): void {
  const shop = open(contractsOf(model, 'shop'));
  shop.schemas = [
    ...shop.schemas,
    {
      id: 'sch:basket',
      name: 'Basket',
      kind: 'payload',
      fields: [
        { name: 'id', type: 'uuid', required: true },
        { name: 'lines', type: 'json', required: true },
      ],
    },
  ];
  shop.interfaces = shop.interfaces.map((i) => ({
    ...i,
    endpoints: [
      ...(i.endpoints ?? []),
      { id: 'api:bff-product', sig: 'GET /api/products/{sku}', response: 'sch:product' },
      { id: 'api:bff-add-line', sig: 'POST /api/basket/lines', response: 'sch:basket' },
    ],
  }));
  shop.screens = [
    ...shop.screens.map((s): Screen => {
      if (s.id === 'scr:product-page') {
        return {
          ...s,
          regions: [
            { id: 'scr:product-page#buy', name: 'Add to basket', reads: ['sch:product'] },
            { id: 'scr:product-page#stock', name: 'Stock' },
          ],
        };
      }
      if (s.id === 'scr:basket') {
        return {
          ...s,
          regions: [
            { id: 'scr:basket#lines', name: 'Lines', at: { x: 5, y: 10, w: 60, h: 60 } },
            { id: 'scr:basket#pay', name: 'Pay button', at: { x: 70, y: 10, w: 25, h: 10 } },
          ],
        };
      }
      return s;
    }),
    ...SHOP_SCREENS,
  ];
}

function orderingToday(model: WorkspaceModel): void {
  const ordering = open(contractsOf(model, 'ordering'));
  ordering.screens = [
    ...ordering.screens,
    {
      id: 'scr:order-email',
      name: 'Order email',
      service: 'svc:order-mailer',
      kind: 'email',
      image: 'assets/order-email.png',
      regions: [{ id: 'scr:order-email#total', name: 'Total', reads: ['sch:order#total_cents'] }],
    },
  ];
  const products = open(contractsOf(model, 'products'));
  products.messages = products.messages.map((m) =>
    m.id === 'msg:product-changed'
      ? { ...m, consumers: [...(m.consumers ?? []), 'svc:shop-bff'] }
      : m,
  );
}

const viewProduct = (): Flow => ({
  id: 'flow:view-product',
  name: 'View a product',
  actor: 'Customer',
  trigger: 'The customer opens a product.',
  outcome: 'The customer sees the price and the stock.',
  steps: [
    {
      id: 'flow:view-product#open',
      from: 'svc:shop-web',
      to: 'svc:shop-bff',
      via: 'api:bff-product',
      action: 'Ask for the product',
      screen: 'scr:product-page',
    },
    {
      id: 'flow:view-product#load',
      from: 'svc:shop-bff',
      to: 'svc:products',
      via: 'api:products-get',
      action: 'Load the product',
      reads: ['sch:product'],
    },
    {
      id: 'flow:view-product#stock',
      from: 'svc:shop-bff',
      to: 'svc:shop-web',
      via: 'internal',
      action: 'Show the stock',
      screen: 'scr:product-page#stock',
    },
  ],
});

const addToBasket = (): Flow => ({
  id: 'flow:add-to-basket',
  name: 'Add to basket',
  actor: 'Customer',
  trigger: 'The customer presses **Add to basket**.',
  outcome: 'The product is in the basket.',
  steps: [
    {
      id: 'flow:add-to-basket#add',
      from: 'svc:shop-web',
      to: 'svc:shop-bff',
      via: 'api:bff-add-line',
      action: 'Add the line',
      screen: 'scr:product-page#buy',
    },
    {
      id: 'flow:add-to-basket#price',
      from: 'svc:shop-bff',
      to: 'svc:products',
      via: 'api:products-get',
      action: 'Price the line',
      reads: ['sch:product'],
    },
    {
      id: 'flow:add-to-basket#show',
      from: 'svc:shop-bff',
      to: 'svc:shop-web',
      via: 'internal',
      action: 'Show the basket',
      screen: 'scr:basket',
    },
  ],
});

const reindexSearch = (): Flow => ({
  id: 'flow:reindex-search',
  name: 'Rebuild the search index',
  actor: 'System',
  trigger: 'Every night a job rebuilds the index.',
  outcome: 'Search finds every product.',
  steps: [
    {
      id: 'flow:reindex-search#pick',
      from: 'svc:search-indexer',
      to: 'svc:search-indexer',
      via: 'internal',
      action: 'Pick the changed products',
    },
    {
      id: 'flow:reindex-search#write',
      from: 'svc:search-indexer',
      to: 'st:search-index',
      via: 'internal',
      action: 'Write the documents',
      writes: ['sch:search-doc'],
    },
  ],
});

/** Place an order, with replies, a card rule, the email it sends and the confirmation it shows. */
function placeOrder(flow: Flow): Flow {
  const steps = flow.steps.map((s) => {
    if (s.id === 'flow:place-order#submit') return { ...s, screen: 'scr:basket#pay' };
    if (s.id === 'flow:place-order#card') {
      return { ...s, logic: 'Only when the customer pays by card.' };
    }
    if (s.id === 'flow:place-order#email') return { ...s, screen: 'scr:order-email' };
    return s;
  });
  return {
    ...flow,
    steps: [
      ...steps,
      {
        id: 'flow:place-order#show',
        from: 'svc:shop-bff',
        to: 'svc:shop-web',
        via: 'internal',
        action: 'Show the confirmation',
        screen: 'scr:confirmation',
      },
    ],
  };
}

/** Publish a product, with a save log the plan drops and a second consumer of the change. */
function publishProduct(flow: Flow): Flow {
  const [save, ...rest] = flow.steps;
  if (save === undefined) throw new Error('no save step');
  return {
    ...flow,
    steps: [
      save,
      {
        id: 'flow:publish-product#log',
        from: 'svc:products',
        to: 'svc:products',
        via: 'internal',
        action: 'Log the save',
      },
      ...rest,
      {
        id: 'flow:publish-product#refresh',
        from: 'st:product-events',
        to: 'svc:shop-bff',
        via: 'msg:product-changed',
        action: 'Refresh the cached product',
      },
    ],
  };
}

function flowsToday(model: WorkspaceModel): Flow[] {
  const byId = new Map(model.flows.map((f) => [f.id, f]));
  const get = (id: string): Flow => {
    const flow = byId.get(id);
    if (flow === undefined) throw new Error(`no ${id}`);
    return flow;
  };
  return [
    viewProduct(),
    addToBasket(),
    placeOrder(get('flow:place-order')),
    get('flow:cancel-order'),
    publishProduct(get('flow:publish-product')),
    reindexSearch(),
  ];
}

function interactionsToday(model: WorkspaceModel): Interaction[] {
  const place = model.interactions.find((i) => i.id === 'ui:place-order');
  const add = model.interactions.find((i) => i.id === 'ui:add-to-basket');
  if (place === undefined || add === undefined) throw new Error('no interactions');
  return [
    {
      id: 'ui:search-product',
      name: 'Open a result',
      from: ['scr:search-results'],
      to: 'scr:product-page',
      trigger: 'click',
      effect: 'navigate',
    },
    add,
    {
      ...place,
      to: 'scr:order-email',
      effect: 'output',
      condition: 'Payment succeeds and the order is created.',
      result: 'The customer receives an order confirmation email.',
      supporting_steps: [
        'flow:place-order#submit',
        'flow:place-order#create',
        'flow:place-order#charge',
        'flow:place-order#email',
      ],
    },
    {
      id: 'ui:header-basket',
      name: 'Basket in the header',
      from: ['scr:product-page', 'scr:search-results', 'scr:confirmation'],
      to: 'scr:basket',
      trigger: 'click',
      effect: 'navigate',
    },
    {
      id: 'ui:basket-product',
      name: 'Open a line',
      from: ['scr:basket#lines'],
      to: 'scr:product-page',
      trigger: 'click',
      effect: 'navigate',
    },
  ];
}

const journeysToday = (model: WorkspaceModel): UserJourney[] => [
  ...model.journeys,
  {
    id: 'uj:recheck',
    name: 'Check a product again',
    actor: 'Customer',
    interactions: ['ui:basket-product', 'ui:add-to-basket'],
  },
];

/** Acme's model of today with replies, screens, journeys, a job and a System flow. */
function coreTodayModel(): WorkspaceModel {
  const model = acmeModel();
  paymentsToday(model);
  shopToday(model);
  orderingToday(model);
  return {
    ...model,
    flows: flowsToday(model),
    interactions: interactionsToday(model),
    journeys: journeysToday(model),
  };
}

/** The richer today as the store reads it. */
const coreToday = (): SystemModel => systemModelOf(acmeWorkspace(), coreTodayModel());

/** The plan as a workspace would hold it in plans/quick-checkout/plan.yaml. */
function quickCheckoutOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'quick-checkout',
      title: 'Make checkout quicker and refunds possible',
      version: '1.0',
      date: '2026-05-26',
      status: 'draft',
      authors: ['Web', 'Orders'],
      appetite: '6 weeks',
      repos: ['acme/shop', 'acme/ordering', 'acme/products'],
    },
    problem: {
      summary: 'Checkout is slow and an order clerk can only cancel; see [[flow:place-order]].',
      why: 'Customers leave a slow basket, and a cancelled order cannot be refunded in part.',
      goals: ['Hold stock while the customer pays', 'Refund an order instead of cancelling it'],
      scenarios: [
        {
          id: 'sc:quick-buy',
          title: 'A quick purchase',
          story: 'A customer adds a product and pays straight away.',
          flows: ['flow:add-to-basket', 'flow:place-order'],
        },
        {
          id: 'sc:refund',
          title: 'A refund',
          story: 'A clerk refunds an order the customer returned.',
          flows: ['flow:refund-order'],
        },
      ],
    },
    context: ['flow:view-product', 'flow:reindex-search', 'scr:search-results'],
    changes: [
      {
        id: 'chg:hold-stock',
        title: 'Hold stock while the customer pays',
        ops: [
          {
            add: 'endpoint',
            into: 'if:orders-rest',
            value: {
              id: 'api:orders-reserve',
              sig: 'POST /reservations',
              response: 'sch:order',
              auth: 'service token',
            },
          },
          {
            add: 'step',
            into: 'flow:add-to-basket',
            after: 'flow:add-to-basket#price',
            value: {
              id: 'flow:add-to-basket#reserve',
              from: 'svc:shop-bff',
              to: 'svc:order-api',
              via: 'api:orders-reserve',
              action: 'Reserve the stock',
            },
          },
          {
            add: 'step',
            into: 'flow:add-to-basket',
            after: 'flow:add-to-basket#reserve',
            value: {
              id: 'flow:add-to-basket#hold',
              from: 'svc:order-api',
              to: 'st:orders-db',
              via: 'internal',
              action: 'Hold the stock',
              writes: ['sch:order#status'],
            },
          },
          {
            modify: 'flow:place-order#card',
            set: { logic: 'Only when the customer pays by card or wallet.' },
          },
        ],
      },
      {
        id: 'chg:basket-layout',
        title: 'Move the pay button up the basket',
        ops: [
          { modify: 'scr:basket', set: { route: '/checkout/basket' } },
          { modify: 'scr:basket#pay', set: { at: { x: 70, y: 2, w: 25, h: 8 } } },
          { modify: 'scr:basket#lines', set: { name: 'Basket lines' } },
        ],
      },
      {
        id: 'chg:refunds',
        title: 'Refund an order instead of cancelling it',
        ops: [
          {
            add: 'endpoint',
            into: 'if:orders-rest',
            value: {
              id: 'api:orders-refund',
              sig: 'POST /orders/{id}/refund',
              response: 'sch:order',
              auth: 'staff SSO',
              idempotent: true,
            },
          },
          {
            add: 'screen',
            value: {
              id: 'scr:refund-email',
              name: 'Refund email',
              service: 'svc:order-mailer',
              kind: 'email',
            },
          },
          {
            add: 'flow',
            value: {
              id: 'flow:refund-order',
              name: 'Refund an order',
              actor: 'Order clerk',
              trigger: 'A customer returns an order.',
              steps: [
                {
                  id: 'flow:refund-order#refund',
                  from: 'svc:order-desk',
                  to: 'svc:order-api',
                  via: 'api:orders-refund',
                  action: 'Refund the order',
                  writes: ['sch:order#status'],
                },
                {
                  id: 'flow:refund-order#email',
                  from: 'svc:order-api',
                  to: 'svc:order-mailer',
                  via: 'internal',
                  action: 'Email the refund',
                  screen: 'scr:refund-email',
                },
              ],
            },
          },
          { remove: 'flow:cancel-order' },
        ],
      },
      {
        id: 'chg:product-v2',
        title: 'Publish product.changed v2 with the price',
        rollout: 'The shop keeps reading v1 while both are published.',
        ops: [
          {
            add: 'schema',
            value: {
              id: 'sch:product-changed-v2',
              name: 'product.changed v2',
              kind: 'payload',
              fields: [
                { name: 'sku', type: 'string', required: true },
                { name: 'price_cents', type: 'int', required: true },
              ],
            },
          },
          {
            add: 'message',
            value: {
              id: 'msg:product-changed-v2',
              name: 'product.changed',
              version: 'v2',
              topic: 'st:product-events',
              payload: 'sch:product-changed-v2',
              producer: 'svc:products',
              consumers: ['svc:search-indexer'],
              key: 'sku',
              supersedes: 'msg:product-changed',
            },
          },
          { deprecate: 'msg:product-changed', replaced_by: 'msg:product-changed-v2' },
          { modify: 'flow:publish-product#announce', set: { via: 'msg:product-changed-v2' } },
          { modify: 'flow:publish-product#index', set: { via: 'msg:product-changed-v2' } },
          { deprecate: 'flow:publish-product#refresh' },
          { remove: 'flow:publish-product#log' },
        ],
      },
      {
        id: 'chg:product-record',
        title: 'Price in pence and a colour on the product',
        ops: [
          { add: 'field', into: 'sch:product', value: { name: 'colour', type: 'string' } },
          { remove: 'sch:product#price_cents' },
          { modify: 'sch:search-doc#words', set: { required: true } },
          {
            modify: 'flow:publish-product#index',
            set: { writes: ['sch:search-doc#sku', 'sch:search-doc#words'] },
          },
          {
            modify: 'flow:reindex-search#write',
            set: { writes: ['sch:search-doc#sku', 'sch:search-doc#words'] },
          },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:checkout-e2e',
        level: 'e2e',
        name: 'A customer buys and a clerk refunds',
        proves: ['chg:hold-stock', 'chg:basket-layout', 'chg:refunds'],
        walks: ['flow:place-order', 'flow:refund-order'],
      },
      {
        id: 'tst:product-contract',
        level: 'contract',
        name: 'product.changed v2 and the product record',
        proves: ['chg:product-v2', 'chg:product-record'],
        walks: ['flow:publish-product'],
      },
    ],
    work_items: [
      {
        id: 'wi:checkout',
        title: 'Hold stock, move the pay button and refund',
        team: 'team:web',
        size: 'M',
        implements: ['chg:hold-stock', 'chg:basket-layout', 'chg:refunds'],
        repo: 'acme/shop',
      },
      {
        id: 'wi:product',
        title: 'Product v2',
        team: 'team:catalogue',
        size: 'S',
        implements: ['chg:product-v2', 'chg:product-record'],
        repo: 'acme/products',
      },
    ],
  };
}

/** The overlay on the richer today. */
export const quickCheckoutOnToday = (): OnToday => planOnToday(quickCheckoutOverlay(), coreToday());
