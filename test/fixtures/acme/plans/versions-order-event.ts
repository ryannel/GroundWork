// A plan that versions an event: order.placed goes to v2, its consumers move over, and v1 is removed in a later
// milestone. It gives the migration ladder a whole run, expand → migrate → retire.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as a workspace would hold it in plans/order-event-v2/plan.yaml. */
export function orderEventV2Overlay(): PlanOverlay {
  return {
    meta: {
      id: 'order-event-v2',
      title: 'Put the total on the order event',
      version: '1.0',
      date: '2026-05-28',
      status: 'draft',
      authors: ['Orders'],
      appetite: '4 weeks',
      repos: ['acme/ordering'],
    },
    problem: {
      summary: 'Everyone who hears [[msg:order-placed]] asks the order API for the total.',
      why: 'The order API answers a million lookups a day that the event could have carried.',
      goals: ['The event carries the total', 'The order desk hears about new orders'],
    },
    changes: [
      {
        id: 'chg:event-v2',
        title: 'Publish order.placed v2 next to v1',
        ops: [
          {
            add: 'schema',
            value: {
              id: 'sch:order-placed-v2',
              name: 'order.placed v2',
              kind: 'payload',
              fields: [
                { name: 'order_id', type: 'uuid', required: true },
                { name: 'total_cents', type: 'int', required: true },
              ],
            },
          },
          {
            add: 'message',
            value: {
              id: 'msg:order-placed-v2',
              name: 'order.placed',
              version: 'v2',
              topic: 'st:order-events',
              payload: 'sch:order-placed-v2',
              producer: 'svc:order-api',
              consumers: ['svc:order-mailer', 'svc:order-desk'],
              key: 'order_id',
              supersedes: 'msg:order-placed',
            },
          },
          { deprecate: 'msg:order-placed', replaced_by: 'msg:order-placed-v2' },
          { deprecate: 'sch:order-placed-v1', replaced_by: 'sch:order-placed-v2' },
          { modify: 'flow:place-order#publish', set: { via: 'msg:order-placed-v2' } },
        ],
      },
      {
        id: 'chg:consumers-move',
        title: 'The mailer and the order desk read v2',
        ops: [
          { modify: 'flow:place-order#email', set: { via: 'msg:order-placed-v2' } },
          {
            add: 'step',
            into: 'flow:place-order',
            after: 'flow:place-order#email',
            value: {
              id: 'flow:place-order#desk',
              from: 'st:order-events',
              to: 'svc:order-desk',
              via: 'msg:order-placed-v2',
              action: 'Show the order on the desk',
            },
          },
        ],
      },
      {
        id: 'chg:retire-v1',
        title: 'Stop publishing order.placed v1',
        ops: [{ remove: 'msg:order-placed' }, { remove: 'sch:order-placed-v1' }],
      },
    ],
    milestones: [
      { id: 'ms:dual', name: 'M1 · Both versions', exit: 'v2 is published next to v1.' },
      { id: 'ms:moved', name: 'M2 · Everyone on v2', exit: 'Nothing reads v1.' },
    ],
    work_items: [
      {
        id: 'wi:publish-v2',
        title: 'Publish v2',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:dual',
        implements: ['chg:event-v2'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:consumers-v2',
        title: 'Mailer and desk read v2',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:dual',
        implements: ['chg:consumers-move'],
        depends_on: ['wi:publish-v2'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:retire-v1',
        title: 'Remove v1',
        team: 'team:orders',
        size: 'XS',
        milestone: 'ms:moved',
        implements: ['chg:retire-v1'],
        depends_on: ['wi:consumers-v2'],
        repo: 'acme/ordering',
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function orderEventV2(): Plan {
  return planOnAcme(orderEventV2Overlay()).plan;
}
