// A plan for the story chapters, still a draft: an overlay on Acme's today that delivers orders on the same day. It
// touches every team, versions `order.placed` (v1 → v2, the mailer moves), breaks readers it does not move, owes
// answers and decisions, carries a low confidence rating and risks of every kind, and proves its changes unevenly.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Commitment, Plan } from '@/domain/plan/plan.generated';

/** The overlay as it would be written in plans/same-day/plan.yaml. */
function sameDayOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'same-day',
      title: 'Deliver on the same day',
      version: '0.3',
      date: '2026-05-20',
      status: 'draft',
      authors: ['Orders'],
      appetite: '8 weeks',
      repos: ['acme/products', 'acme/search', 'acme/ordering', 'acme/payments', 'acme/shop'],
    },
    problem: {
      summary: 'A customer who orders before noon still waits two days.',
      why: 'Three customers in ten leave the basket when the earliest delivery is two days away.',
      goals: [
        'An order placed before the cut-off arrives the same day',
        'The product page says so',
      ],
      non_goals: ['Delivery on Sundays'],
      metrics: [
        { name: 'Baskets left at delivery', today: '30% of baskets', target: '20% of baskets' },
      ],
      scenarios: [
        {
          id: 'sc:pick-slot',
          title: 'A customer picks an afternoon slot',
          story: 'The customer orders at ten and picks a slot after four.',
          flows: ['flow:pick-slot', 'flow:place-order'],
        },
      ],
    },
    changes: [
      {
        id: 'chg:product-same-day',
        title: 'Products say whether they can go the same day',
        why: 'The answer is born where the product is.',
        decisions: ['dec:cutoff-source'],
        ops: [
          { add: 'field', into: 'sch:product', value: { name: 'same_day', type: 'bool' } },
          { add: 'field', into: 'sch:product', value: { name: 'cutoff_hour', type: 'int' } },
        ],
      },
      {
        id: 'chg:search-same-day',
        title: 'Search finds what can go the same day',
        ops: [
          {
            add: 'field',
            into: 'sch:search-doc',
            value: { name: 'same_day', type: 'bool', required: true },
          },
          {
            modify: 'flow:publish-product#index',
            set: { writes: ['sch:search-doc#same_day'] },
          },
        ],
      },
      {
        id: 'chg:order-slot',
        title: 'Orders keep the delivery slot instead of the total',
        why: 'The total moves to the payment; the order keeps what the courier needs.',
        ops: [
          { remove: 'sch:order#total_cents' },
          { add: 'field', into: 'sch:order', value: { name: 'slot', type: 'string' } },
        ],
      },
      {
        id: 'chg:placed-v2',
        title: 'Publish order.placed v2 with the slot',
        decisions: ['dec:placed-side-by-side'],
        ops: [
          {
            add: 'field',
            into: 'sch:order-placed-v1',
            value: { name: 'slot', type: 'string', required: true },
          },
          {
            add: 'schema',
            value: {
              id: 'sch:order-placed-v2',
              name: 'order.placed v2',
              kind: 'payload',
              fields: [
                { name: 'order_id', type: 'uuid', required: true },
                { name: 'slot', type: 'string', required: true },
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
              consumers: ['svc:order-mailer'],
              key: 'order_id',
              supersedes: 'msg:order-placed',
            },
          },
          { modify: 'flow:place-order#publish', set: { via: 'msg:order-placed-v2' } },
          { modify: 'flow:place-order#email', set: { via: 'msg:order-placed-v2' } },
          { deprecate: 'msg:order-placed', replaced_by: 'msg:order-placed-v2' },
        ],
      },
      {
        id: 'chg:cancel-before-dispatch',
        title: 'A clerk can cancel only before the courier collects',
        ops: [
          {
            modify: 'flow:cancel-order#cancel',
            set: { fails: 'An order the courier has collected cannot be cancelled.' },
          },
        ],
      },
      {
        id: 'chg:hold-funds',
        title: 'Payments holds the funds until the slot is met',
        decisions: ['dec:hold-funds'],
        ops: [
          {
            modify: 'flow:place-order#charge',
            set: { action: 'Hold the payment until the slot is met' },
          },
        ],
      },
      {
        id: 'chg:pick-slot',
        title: 'The shop lets a customer pick a slot',
        decisions: ['dec:slot-window'],
        ops: [
          {
            add: 'endpoint',
            into: 'if:shop-bff',
            value: { id: 'api:bff-slots', sig: 'GET /api/slots' },
          },
          {
            add: 'flow',
            value: {
              id: 'flow:pick-slot',
              name: 'Pick a delivery slot',
              actor: 'Customer',
              trigger: 'The customer opens the basket.',
              steps: [
                {
                  id: 'flow:pick-slot#slots',
                  from: 'svc:shop-web',
                  to: 'svc:shop-bff',
                  via: 'api:bff-slots',
                  action: 'Ask for today’s slots',
                  screen: 'scr:basket',
                },
              ],
            },
          },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:product-unit',
        level: 'unit',
        name: 'A product keeps its same-day flag',
        proves: ['chg:product-same-day'],
        walks: ['flow:publish-product#save'],
        owner: 'team:catalogue',
        env: 'ci',
      },
      {
        id: 'tst:index-contract',
        level: 'contract',
        name: 'The indexer writes the same-day flag',
        proves: ['chg:search-same-day'],
        walks: ['flow:publish-product#index'],
        owner: 'team:catalogue',
        env: 'ci',
      },
      {
        id: 'tst:order-service',
        level: 'service',
        name: 'An order keeps its slot',
        proves: ['chg:order-slot', 'chg:cancel-before-dispatch'],
        walks: ['flow:place-order#create'],
        owner: 'team:orders',
        env: 'ci',
      },
      {
        id: 'tst:placed-contract',
        level: 'contract',
        name: 'The mailer reads v2',
        proves: ['chg:placed-v2'],
        walks: ['flow:place-order#email'],
        owner: 'team:orders',
        env: 'ci',
      },
      {
        id: 'tst:hold-service',
        level: 'service',
        name: 'Payments holds the funds',
        proves: ['chg:hold-funds'],
        walks: ['flow:place-order#charge'],
        owner: 'team:payments',
        env: 'ci',
      },
      {
        id: 'tst:slot-e2e',
        level: 'e2e',
        name: 'A customer picks a slot',
        proves: ['chg:pick-slot'],
        walks: ['flow:pick-slot'],
        owner: 'team:web',
        env: 'staging',
      },
    ],
    milestones: [
      {
        id: 'ms:m1',
        name: 'M1 · Slots exist',
        exit: 'Every order can carry a slot.',
        due: '2026-07-03',
      },
      { id: 'ms:m2', name: 'M2 · Customers pick them', due: '2026-07-31' },
    ],
    work_items: [
      {
        id: 'wi:product-flag',
        title: 'Same-day flag on the product',
        team: 'team:catalogue',
        size: 'S',
        milestone: 'ms:m1',
        implements: ['chg:product-same-day'],
        verified_by: ['tst:product-unit'],
        repo: 'acme/products',
      },
      {
        id: 'wi:search-flag',
        title: 'Index the same-day flag (every region)',
        team: 'team:catalogue',
        size: 'XL',
        milestone: 'ms:m1',
        implements: ['chg:search-same-day'],
        verified_by: ['tst:index-contract'],
        depends_on: ['wi:product-flag'],
        repo: 'acme/search',
      },
      {
        id: 'wi:order-slot',
        title: 'Keep the slot on the order',
        team: 'team:orders',
        size: 'M',
        milestone: 'ms:m1',
        implements: ['chg:order-slot'],
        verified_by: ['tst:order-service'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:placed-v2',
        title: 'Publish order.placed v2',
        team: 'team:orders',
        size: 'M',
        milestone: 'ms:m2',
        implements: ['chg:placed-v2'],
        verified_by: ['tst:placed-contract'],
        depends_on: ['wi:order-slot'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:cancel-rule',
        title: 'Refuse a cancel once collected',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:m2',
        implements: ['chg:cancel-before-dispatch'],
        depends_on: ['wi:order-slot'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:hold-funds',
        title: 'Hold the funds until the slot',
        team: 'team:payments',
        size: 'M',
        milestone: 'ms:m2',
        implements: ['chg:hold-funds'],
        verified_by: ['tst:hold-service'],
        depends_on: ['wi:order-slot'],
        repo: 'acme/payments',
      },
      {
        id: 'wi:pick-slot',
        title: 'Let the customer pick a slot',
        team: 'team:web',
        size: 'M',
        milestone: 'ms:m2',
        implements: ['chg:pick-slot'],
        verified_by: ['tst:slot-e2e'],
        depends_on: ['wi:search-flag', 'wi:placed-v2'],
        repo: 'acme/shop',
      },
    ],
    decisions: [
      {
        id: 'dec:cutoff-source',
        title: 'Keep the cut-off on the product',
        status: 'accepted',
        decider: 'team:catalogue',
        decided_on: '2026-05-12',
        reversibility: 'one-way',
        decision: 'Each product carries its own cut-off hour.',
        options: [{ name: 'One cut-off for the shop', why_not: 'Fresh goods leave earlier.' }],
      },
      {
        id: 'dec:placed-side-by-side',
        title: 'Publish v2 next to v1 until the mailer moves',
        status: 'accepted',
        decider: 'team:orders',
        decided_on: '2026-05-14',
        reversibility: 'two-way',
      },
      {
        id: 'dec:slot-window',
        title: 'Offer two-hour slots',
        status: 'proposed',
        decider: 'team:web',
        decide_by: '2026-06-10',
        reversibility: 'one-way',
      },
      {
        id: 'dec:hold-funds',
        title: 'Hold the funds rather than charge at once',
        status: 'proposed',
        decider: 'team:orders',
        decide_by: '2026-06-17',
        reversibility: 'one-way',
      },
      {
        id: 'dec:badge-colour',
        title: 'Show the same-day badge in green',
        status: 'proposed',
        decider: 'team:web',
        reversibility: 'two-way',
      },
      {
        id: 'dec:courier-api',
        title: 'Book couriers through their API',
        status: 'deferred',
        decide_by: '2026-09-01',
        decider: 'team:orders',
      },
      { id: 'dec:own-vans', title: 'Run our own vans', status: 'rejected', decider: 'team:orders' },
      {
        id: 'dec:noon-cutoff',
        title: 'One noon cut-off for every product',
        status: 'superseded',
        decider: 'team:catalogue',
      },
    ],
    questions: [
      {
        id: 'q:cutoff-hour',
        question: 'Which hour is the cut-off for fresh goods?',
        status: 'open',
        decider: 'team:catalogue',
        decide_by: '2026-06-05',
        answer: 'Noon, unless Catalogue says otherwise.',
        blocks: ['wi:search-flag'],
      },
      {
        id: 'q:refund-window',
        question: 'How long after a missed slot is the refund paid?',
        status: 'open',
        decider: 'team:orders',
        decide_by: '2026-06-24',
        blocks: ['wi:cancel-rule'],
      },
      {
        id: 'q:which-cities',
        question: 'Which cities get slots first?',
        status: 'open',
        decider: 'team:web',
        answered_by: 'dec:slot-window',
      },
      {
        id: 'q:courier-names',
        question: 'Which couriers deliver the same day?',
        status: 'resolved',
        answer: 'Two, both in the big cities.',
      },
    ],
    risks: [
      {
        id: 'risk:courier-late',
        statement: 'A courier misses the slot.',
        likelihood: 'high',
        impact: 'high',
        roam: 'owned',
        owner: 'team:orders',
      },
      {
        id: 'risk:wrong-flag',
        statement: 'A product says same day when it cannot go.',
        likelihood: 'med',
        impact: 'high',
        roam: 'mitigated',
        owner: 'team:catalogue',
        mitigation: 'The flag is off until the cut-off is known.',
      },
      {
        id: 'risk:cost',
        statement: 'Same-day couriers cost more than the delivery charge.',
        likelihood: 'med',
        impact: 'med',
        roam: 'accepted',
        accepted_by: 'dec:cutoff-source',
      },
      {
        id: 'risk:stock',
        statement: 'The warehouse runs out of a same-day product.',
        likelihood: 'low',
        impact: 'med',
        roam: 'owned',
        owner: 'team:catalogue',
      },
      {
        id: 'risk:search-lag',
        statement: 'Search shows the flag late.',
        likelihood: 'low',
        impact: 'low',
        roam: 'resolved',
      },
    ],
    commitment: [
      { team: 'team:catalogue', confidence: 4 },
      { team: 'team:orders', confidence: 3 },
      { team: 'team:web', confidence: 4 },
      {
        team: 'team:payments',
        confidence: 2,
        note: 'The hold is not agreed with the card provider yet.',
      },
    ],
  };
}

/** The draft as the app draws it: Payments is not confident. */
export function sameDay(): Plan {
  return planOnAcme(sameDayOverlay()).plan;
}

const CONFIDENT: readonly Commitment[] = [
  { team: 'team:catalogue', confidence: 4 },
  { team: 'team:orders', confidence: 3 },
  { team: 'team:web', confidence: 4 },
  { team: 'team:payments', confidence: 3 },
];

/** The same draft once every team rates it 3 or more. */
export function sameDayConfident(): Plan {
  return planOnAcme({ ...sameDayOverlay(), commitment: [...CONFIDENT] }).plan;
}
