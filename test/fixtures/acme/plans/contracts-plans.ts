// Every plan the contract, flow, graph and map views are drawn over: three plans on Acme and the federated shop.
import { shop } from '@/../test/federation-kit';
import { deliveryTime } from '@/../test/fixtures/acme/plans/contracts-delivery-time';
import { reworkCheckout } from '@/../test/fixtures/acme/plans/contracts-rework-checkout';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import type { Plan } from '@/domain/plan/plan.generated';

/** Each plan by name, fresh on every call. */
export function contractsPlans(): readonly (readonly [string, Plan])[] {
  return [
    ['pause-orders', pauseOrders()],
    ['delivery-time', deliveryTime()],
    ['rework-checkout', reworkCheckout()],
    ['shop', shop()],
  ];
}

/**
 * Delivery time with the services laid out in stages, so each system's deployables share a column and the
 * system map draws them as one card with its parts inside.
 */
export function stagedDeliveryTime(): Plan {
  const plan = deliveryTime();
  plan.domain = {
    stages: [
      {
        id: 'stage:publish',
        name: 'Publish',
        services: [{ svc: 'svc:products' }, { svc: 'svc:product-admin' }],
      },
      {
        id: 'stage:pay',
        name: 'Pay',
        services: [{ svc: 'svc:payments' }, { svc: 'svc:card-provider' }],
      },
    ],
  };
  return plan;
}

/** The federated shop, also retiring the old pricing subgraph now that pricing v2 takes its place. */
export function shopRetiringPricing(): Plan {
  const plan = shop();
  plan.changes = [
    ...(plan.changes ?? []),
    {
      id: 'chg:retire-pricing',
      title: 'Retire the old pricing subgraph',
      ops: [{ deprecate: 'sg:pricing' }],
    },
  ];
  plan.tests = [
    ...(plan.tests ?? []),
    {
      id: 'tst:pricing-retired',
      level: 'contract',
      name: 'Nothing reads the old pricing subgraph',
      proves: ['chg:retire-pricing'],
    },
  ];
  for (const item of plan.work_items ?? []) {
    if (item.id === 'wi:pricing-v2') item.implements = [...item.implements, 'chg:retire-pricing'];
  }
  return plan;
}
