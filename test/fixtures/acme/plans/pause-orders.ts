// An example plan as a workspace holds it: an overlay on Acme's today that lets an order clerk pause an order.
// A template for area tests: copy it, change what it changes, and check it with planOnAcme.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as written in plans/pause-orders/plan.yaml. */
export function pauseOrdersOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'pause-orders',
      title: 'Let an order clerk pause an order',
      version: '1.0',
      date: '2026-05-20',
      status: 'draft',
      authors: ['Orders'],
      appetite: '2 weeks',
      repos: ['acme/ordering'],
    },
    problem: {
      summary: 'An order clerk can only cancel an order; see [[flow:cancel-order]].',
      why: 'One order in fifty is cancelled only because stock is late, and the customer orders again.',
      goals: ['Pause an order for up to 14 days', 'No confirmation email for a paused order'],
      non_goals: ['Customers pausing their own orders'],
      scenarios: [
        {
          id: 'sc:late-stock',
          title: 'Stock is late',
          story: 'A clerk pauses an order until the stock arrives.',
          flows: ['flow:pause-order'],
        },
      ],
    },
    context: ['flow:cancel-order'],
    changes: [
      {
        id: 'chg:pause-endpoint',
        title: 'Add the pause endpoint and the paused status',
        why: 'The order desk needs a way to pause; see [[dec:pause-in-place]].',
        decisions: ['dec:pause-in-place'],
        ops: [
          { add: 'field', into: 'sch:order', value: { name: 'paused_until', type: 'date?' } },
          {
            modify: 'sch:order#status',
            set: { type: 'enum(placed, paid, paused, cancelled)' },
          },
          {
            add: 'endpoint',
            into: 'if:orders-rest',
            value: {
              id: 'api:orders-pause',
              sig: 'POST /orders/{id}/pause',
              response: 'sch:order',
              auth: 'staff SSO',
              idempotent: true,
            },
          },
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
                  via: 'api:orders-pause',
                  action: 'Pause the order',
                  writes: ['sch:order#status', 'sch:order#paused_until'],
                },
              ],
            },
          },
        ],
      },
      {
        id: 'chg:mailer-skips-paused',
        title: 'The mailer skips paused orders',
        ops: [
          {
            modify: 'flow:place-order#email',
            set: { logic: 'Skip the email while the order is paused.' },
          },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:pause-contract',
        level: 'contract',
        name: 'Pause contract',
        proves: ['chg:pause-endpoint'],
        walks: ['flow:pause-order#pause'],
        owner: 'team:orders',
        env: 'ci',
      },
      {
        id: 'tst:mailer-skips',
        level: 'unit',
        name: 'Mailer skips paused orders',
        proves: ['chg:mailer-skips-paused'],
        walks: ['flow:place-order#email'],
        owner: 'team:orders',
        env: 'local',
      },
    ],
    milestones: [
      { id: 'ms:pause', name: 'Clerks can pause', exit: 'A clerk pauses an order in staging.' },
    ],
    work_items: [
      {
        id: 'wi:pause-api',
        title: 'Pause endpoint',
        team: 'team:orders',
        size: 'M',
        milestone: 'ms:pause',
        implements: ['chg:pause-endpoint'],
        verified_by: ['tst:pause-contract'],
        repo: 'acme/ordering',
        body: 'Build [[api:orders-pause]].',
      },
      {
        id: 'wi:desk-button',
        title: 'Pause button on the order desk',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:pause',
        implements: ['chg:pause-endpoint'],
        depends_on: ['wi:pause-api'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:mailer-skip',
        title: 'Mailer skips paused orders',
        team: 'team:orders',
        size: 'XS',
        milestone: 'ms:pause',
        implements: ['chg:mailer-skips-paused'],
        verified_by: ['tst:mailer-skips'],
        depends_on: ['wi:pause-api'],
        repo: 'acme/ordering',
      },
    ],
    decisions: [
      {
        id: 'dec:pause-in-place',
        title: 'Pause the order in place',
        status: 'accepted',
        decider: 'team:orders',
        decided_on: '2026-05-18',
        reversibility: 'two-way',
        options: [{ name: 'Cancel and re-order', why_not: 'The customer is charged twice.' }],
      },
    ],
    risks: [
      {
        id: 'risk:paused-forever',
        statement: 'An order stays paused and is forgotten.',
        likelihood: 'med',
        impact: 'med',
        roam: 'owned',
        owner: 'team:orders',
        mitigation: 'A pause ends by itself after 14 days.',
        about: ['sch:order'],
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function pauseOrders(): Plan {
  return planOnAcme(pauseOrdersOverlay()).plan;
}
