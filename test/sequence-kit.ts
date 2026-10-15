import { shop } from '@/../test/federation-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The shop with one richer flow added: a person, a trigger, a call that answers and can fail, a step inside one service, a group. */
export function sequencePlan(): Plan {
  const plan = shop();
  plan.flows = [
    ...(plan.flows ?? []),
    {
      id: 'flow:rich',
      name: 'Price a product',
      actor: 'Shopper',
      trigger: 'The **shopper** opens [[svc:web]]',
      steps: [
        {
          id: 'flow:rich#ask',
          from: 'svc:web',
          to: 'svc:pricing-api',
          via: 'api:pricing-price',
          action: 'Ask for the price',
          fails: 'The price is `unknown` and [[svc:web]] shows a dash',
          screen: 'scr:pdp#hero',
          reads: ['sch:price'],
        },
        {
          id: 'flow:rich#keep',
          from: 'svc:pricing-api',
          to: 'svc:pricing-api',
          via: 'internal',
          action: 'Keep it',
          writes: ['sch:price'],
          screen: 'scr:cart#list',
          logic: 'Only when it **changed**.',
        },
        {
          id: 'flow:rich#tell',
          from: 'svc:pricing-api',
          to: 'st:price-topic',
          via: 'msg:price-published',
          action: 'Tell the others',
          beat: 'On publish',
        },
        {
          id: 'flow:rich#hear',
          from: 'st:price-topic',
          to: 'svc:purger',
          via: 'msg:price-published',
          action: 'Hear it',
          beat: 'On publish',
        },
      ],
    },
  ];
  plan.screens = [
    ...(plan.screens ?? []),
    {
      id: 'scr:cart',
      name: 'Cart',
      service: 'svc:web',
      regions: [{ id: 'scr:cart#list', name: 'List' }],
    },
  ];
  plan.tests = [
    ...(plan.tests ?? []),
    {
      id: 'tst:rich-walk',
      level: 'unit',
      name: 'Prices a product',
      proves: [],
      walks: ['flow:rich#keep', 'flow:rich#tell'],
    },
    {
      id: 'tst:rich-all',
      level: 'e2e',
      name: 'Prices end to end',
      proves: [],
      walks: ['flow:rich'],
    },
  ];
  return plan;
}
