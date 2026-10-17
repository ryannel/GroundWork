// A plan that changes what a customer sees and does: gift wrapping chosen on the basket. It adds a step to placing
// an order, a new flow, a new screen and an interaction, and a new word, so the journey and today chapters have a
// before and an after.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as a workspace would hold it in plans/gift-wrap/plan.yaml. */
export function giftWrapOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'gift-wrap',
      title: 'Let a customer gift-wrap an order',
      version: '1.0',
      date: '2026-05-25',
      status: 'draft',
      authors: ['Web'],
      appetite: '3 weeks',
      repos: ['acme/shop', 'acme/ordering'],
    },
    problem: {
      summary: 'A customer cannot send an order as a gift; see [[flow:place-order]].',
      why: 'One customer in ten writes to support asking for gift wrapping before Christmas.',
      goals: ['Choose wrapping on the basket', 'Pay for wrapping with the order'],
      scenarios: [
        {
          id: 'sc:birthday-gift',
          title: 'A birthday present',
          story: 'A customer wraps a present for a friend and sends it straight to them.',
          flows: ['flow:place-order', 'flow:wrap-order'],
        },
        {
          id: 'sc:no-wrap',
          title: 'No wrapping today',
          story: 'A customer buys for themselves and skips the wrapping.',
          flows: ['flow:place-order'],
        },
      ],
    },
    context: ['flow:publish-product'],
    domain: {
      concepts: [
        {
          id: 'con:gift-wrap',
          name: 'Gift wrap',
          terms: ['gift wrap', 'wrapping'],
          means: 'Paper and a card around an order, chosen on the basket and paid for with it.',
          born_in: 'svc:shop-bff',
          relates: [{ to: 'con:basket', as: 'is chosen in the' }],
          introduced_by: ['chg:wrap-step'],
        },
        {
          id: 'con:gift-note',
          name: 'Gift note',
          terms: ['gift note'],
          means: 'A line the customer writes for the person who opens the parcel.',
          born_in: 'svc:shop-bff',
          relates: [{ to: 'con:gift-wrap', as: 'travels with the' }],
          introduced_by: ['chg:wrap-screen'],
        },
        {
          id: 'con:basket',
          name: 'Basket',
          terms: ['basket', 'cart'],
          means: 'What a customer means to buy, before it is an order.',
          born_in: 'svc:shop-bff',
          aka: [{ in: 'svc:shop-web', as: 'cart', at: 'svc:shop-web' }],
        },
      ],
    },
    changes: [
      {
        id: 'chg:wrap-step',
        title: 'Price the wrapping when the order is placed',
        why: 'The order has to carry the wrapping it was paid for.',
        ops: [
          { add: 'field', into: 'sch:order', value: { name: 'gift_wrap', type: 'bool' } },
          {
            modify: 'flow:place-order#submit',
            set: { action: 'Send the basket and the wrapping' },
          },
          {
            add: 'step',
            into: 'flow:place-order',
            after: 'flow:place-order#submit',
            value: {
              id: 'flow:place-order#wrap',
              from: 'svc:shop-bff',
              to: 'svc:shop-bff',
              via: 'internal',
              action: 'Price the wrapping',
            },
          },
          {
            modify: 'flow:place-order#create',
            set: { action: 'Create the order with its wrapping' },
          },
        ],
      },
      {
        id: 'chg:wrap-screen',
        title: 'Choose the wrapping on its own screen',
        ops: [
          {
            add: 'endpoint',
            into: 'if:shop-bff',
            value: { id: 'api:bff-gift-wrap', sig: 'PUT /api/basket/wrap', response: 'sch:order' },
          },
          {
            add: 'screen',
            value: {
              id: 'scr:gift-wrap',
              name: 'Gift wrap',
              service: 'svc:shop-web',
              kind: 'sheet',
              route: '/basket/wrap',
              regions: [
                { id: 'scr:gift-wrap#paper', name: 'Paper', reads: ['sch:order#gift_wrap'] },
              ],
            },
          },
          {
            add: 'flow',
            value: {
              id: 'flow:wrap-order',
              name: 'Wrap an order',
              actor: 'Customer',
              trigger: 'The customer ticks **Gift wrap** on the basket.',
              outcome: 'The basket carries the wrapping.',
              steps: [
                {
                  id: 'flow:wrap-order#open',
                  from: 'svc:shop-web',
                  to: 'svc:shop-web',
                  via: 'internal',
                  action: 'Open the wrapping sheet',
                  screen: 'scr:gift-wrap',
                },
                {
                  id: 'flow:wrap-order#pick',
                  from: 'svc:shop-web',
                  to: 'svc:shop-bff',
                  via: 'api:bff-gift-wrap',
                  action: 'Pick the paper',
                  screen: 'scr:gift-wrap#paper',
                },
              ],
            },
          },
        ],
      },
    ],
    execution: {
      summary:
        'Wrapping is chosen once on the basket and paid for with the order. Nothing else in the order changes.',
      paths: [
        {
          name: 'The customer wraps a present',
          summary: 'The wrapping travels with the basket into the order.',
          steps: [
            { label: 'Choose', detail: 'The customer picks a paper ([[flow:wrap-order]]).' },
            { label: 'Price', detail: 'The BFF prices it with the basket ([[flow:place-order]]).' },
            { label: 'Pay', detail: 'The card is charged for both ([[flow:place-order#charge]]).' },
            { label: 'Ship', detail: 'The warehouse wraps the parcel.' },
          ],
        },
        {
          name: 'The catalogue stays as it is',
          steps: [
            {
              label: 'Save',
              detail: 'Products are published as today ([[flow:publish-product]]).',
            },
            { label: 'Find', detail: 'Search finds them as today.' },
          ],
        },
      ],
    },
    milestones: [
      { id: 'ms:wrap', name: 'Wrapping on sale', exit: 'A customer buys a wrapped order.' },
    ],
    work_items: [
      {
        id: 'wi:wrap-sheet',
        title: 'Gift wrap sheet',
        team: 'team:web',
        size: 'M',
        milestone: 'ms:wrap',
        implements: ['chg:wrap-screen'],
        repo: 'acme/shop',
      },
      {
        id: 'wi:wrap-order',
        title: 'Orders carry the wrapping',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:wrap',
        implements: ['chg:wrap-step'],
        depends_on: ['wi:wrap-sheet'],
        repo: 'acme/ordering',
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function giftWrap(): Plan {
  return planOnAcme(giftWrapOverlay()).plan;
}
