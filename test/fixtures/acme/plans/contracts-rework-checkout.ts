// A plan about flows and screens on Acme: the basket gets a new look, the mailer stops emailing for a card that
// is retired, an order carries a note, a product is checked before it is announced, and an order clerk pauses an
// order instead of cancelling it.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as written in plans/rework-checkout/plan.yaml. */
function reworkCheckoutOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'rework-checkout',
      title: 'Rework checkout and order handling',
      version: '1.0',
      date: '2026-05-28',
      status: 'draft',
      authors: ['Web', 'Orders'],
      repos: ['acme/ordering'],
    },
    problem: {
      summary: 'Checkout and order handling have grown apart; see [[flow:place-order]].',
      why: 'Customers abandon the basket and clerks cancel orders they only meant to hold.',
      goals: ['A clearer basket', 'Pause instead of cancel'],
    },
    context: ['uj:buy'],
    changes: [
      {
        id: 'chg:basket-look',
        title: 'The basket gets a new look',
        ops: [{ modify: 'scr:basket', set: { image: 'assets/basket-tobe.png' } }],
      },
      {
        id: 'chg:email-after-payment',
        title: 'Email only once the payment is through',
        why: 'Customers were emailed for orders that were never paid.',
        decisions: ['dec:email-after-payment'],
        ops: [
          {
            modify: 'flow:place-order#email',
            set: { logic: 'Email only when the order is paid.' },
          },
        ],
      },
      {
        id: 'chg:retire-card-step',
        title: 'Retire the direct card charge',
        rollout: 'Keep the direct charge for a week behind a switch.',
        ops: [{ deprecate: 'flow:place-order#card' }],
      },
      {
        id: 'chg:order-note',
        title: 'An order carries a note',
        ops: [{ add: 'field', into: 'sch:order', value: { name: 'note', type: 'string' } }],
      },
      {
        id: 'chg:check-product',
        title: 'Check a product before announcing it',
        ops: [
          {
            add: 'step',
            into: 'flow:publish-product',
            after: 'flow:publish-product#save',
            value: {
              id: 'flow:publish-product#check',
              from: 'svc:products',
              to: 'svc:products',
              via: 'internal',
              action: 'Check the product is complete',
            },
          },
        ],
      },
      {
        id: 'chg:pause-not-cancel',
        title: 'Pause an order instead of cancelling it',
        ops: [
          {
            add: 'flow',
            value: {
              id: 'flow:pause-order',
              name: 'Pause an order',
              actor: 'Order clerk',
              steps: [
                {
                  id: 'flow:pause-order#pause',
                  from: 'svc:order-desk',
                  to: 'svc:order-api',
                  via: 'api:orders-cancel',
                  action: 'Pause the order',
                  writes: ['sch:order#status'],
                },
              ],
            },
          },
          { remove: 'flow:cancel-order' },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:checkout-e2e',
        level: 'e2e',
        name: 'Checkout end to end',
        proves: [
          'chg:basket-look',
          'chg:email-after-payment',
          'chg:retire-card-step',
          'chg:order-note',
          'chg:check-product',
          'chg:pause-not-cancel',
        ],
        walks: ['flow:place-order#submit'],
        owner: 'team:web',
        env: 'staging',
      },
    ],
    work_items: [
      {
        id: 'wi:checkout',
        title: 'Rework checkout',
        team: 'team:web',
        size: 'L',
        implements: [
          'chg:basket-look',
          'chg:email-after-payment',
          'chg:retire-card-step',
          'chg:order-note',
          'chg:check-product',
          'chg:pause-not-cancel',
        ],
        verified_by: ['tst:checkout-e2e'],
        repo: 'acme/ordering',
      },
    ],
    decisions: [
      {
        id: 'dec:email-after-payment',
        title: 'Email after payment',
        status: 'accepted',
        decider: 'team:orders',
        decided_on: '2026-05-26',
        reversibility: 'two-way',
        options: [{ name: 'Email on every order', why_not: 'Unpaid orders get emails.' }],
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function reworkCheckout(): Plan {
  return planOnAcme(reworkCheckoutOverlay()).plan;
}
