// A plan whose tests are mostly contract tests: an overlay on Acme's today that lets the shop search and sends a
// receipt when an order is placed. Its contract tests check six providers, one checks no call at all, and the
// receipt's new event has no contract test.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as it would be written in plans/checkout-contracts/plan.yaml. */
function checkoutContractsOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'checkout-contracts',
      title: 'Check every call at checkout',
      version: '1.0',
      date: '2026-10-05',
      status: 'draft',
      authors: ['Web'],
      repos: ['acme/shop', 'acme/payments'],
    },
    problem: {
      summary: 'Checkout breaks when a provider changes a call nobody checks.',
      why: 'Two outages this year came from a call that changed under its caller.',
    },
    changes: [
      {
        id: 'chg:shop-searches',
        title: 'The shop searches through the search API',
        ops: [
          {
            add: 'flow',
            value: {
              id: 'flow:find-product',
              name: 'Find a product',
              actor: 'Customer',
              steps: [
                {
                  id: 'flow:find-product#search',
                  from: 'svc:shop-bff',
                  to: 'svc:search-api',
                  via: 'api:search-query',
                  action: 'Search for products',
                },
              ],
            },
          },
        ],
      },
      {
        id: 'chg:charge-retries',
        title: 'A declined charge is retried once',
        ops: [
          {
            modify: 'flow:place-order#charge',
            set: { logic: 'Retry a declined charge once before giving up.' },
          },
        ],
      },
      {
        id: 'chg:receipt',
        title: 'Payments sends a receipt for every order',
        ops: [
          { modify: 'msg:order-placed', append: { consumers: ['svc:payments'] } },
          {
            add: 'step',
            into: 'flow:place-order',
            value: {
              id: 'flow:place-order#receipt',
              from: 'st:order-events',
              to: 'svc:payments',
              via: 'msg:order-placed',
              action: 'Send the receipt',
            },
          },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:bff-contract',
        level: 'contract',
        name: 'The shop calls the BFF',
        proves: ['chg:charge-retries'],
        walks: ['flow:place-order#submit', 'flow:place-order#create'],
        owner: 'team:web',
        env: 'ci',
      },
      {
        id: 'tst:charge-contract',
        level: 'contract',
        name: 'Orders charge through Payments',
        proves: ['chg:charge-retries'],
        walks: ['flow:place-order#charge', 'flow:place-order#card'],
        owner: 'team:payments',
        env: 'ci',
      },
      {
        id: 'tst:search-contract',
        level: 'contract',
        name: 'The BFF searches',
        proves: ['chg:shop-searches'],
        walks: ['flow:find-product#search', 'flow:publish-product#save'],
        owner: 'team:web',
        env: 'ci',
      },
      {
        id: 'tst:receipt-contract',
        level: 'contract',
        name: 'Receipts are sent',
        proves: ['chg:receipt'],
        walks: [],
        owner: 'team:payments',
        env: 'ci',
      },
      {
        id: 'tst:checkout-e2e',
        level: 'e2e',
        name: 'A customer finds a product and buys it',
        proves: ['chg:shop-searches', 'chg:charge-retries', 'chg:receipt'],
        walks: ['flow:find-product#search', 'flow:place-order#charge', 'flow:place-order#receipt'],
        owner: 'team:web',
        env: 'staging',
      },
    ],
    work_items: [
      {
        id: 'wi:shop-search',
        title: 'Search from the BFF',
        team: 'team:web',
        size: 'M',
        implements: ['chg:shop-searches'],
        verified_by: ['tst:search-contract'],
        repo: 'acme/shop',
      },
      {
        id: 'wi:charge-retry',
        title: 'Retry a declined charge',
        team: 'team:payments',
        size: 'S',
        implements: ['chg:charge-retries'],
        verified_by: ['tst:charge-contract'],
        repo: 'acme/payments',
      },
      {
        id: 'wi:receipt',
        title: 'Send receipts',
        team: 'team:payments',
        size: 'M',
        implements: ['chg:receipt'],
        depends_on: ['wi:charge-retry'],
        repo: 'acme/payments',
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function checkoutContracts(): Plan {
  return planOnAcme(checkoutContractsOverlay()).plan;
}
