// A plan about work, people and decisions: an overlay on Acme's today that promises a dispatch date on every
// product. It versions `product.changed` (v1 → v2, two readers move, v1 is removed), builds in four milestones
// across three teams, and carries tests, a question, decisions, a risk and the plan's own words.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as it would be written in plans/dispatch-date/plan.yaml. */
function dispatchDateOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'dispatch-date',
      title: 'Promise a dispatch date',
      version: '1.0',
      date: '2026-10-01',
      status: 'draft',
      authors: ['Catalogue'],
      appetite: '6 weeks',
      repos: ['acme/products', 'acme/search', 'acme/ordering', 'acme/shop'],
    },
    problem: {
      summary: 'A customer cannot tell when a product will leave the warehouse.',
      why: 'One question in five to support asks when an order ships.',
      goals: ['Every product carries the days until dispatch'],
    },
    domain: {
      summary: 'A product is born in the catalogue and copied into search.',
      concepts: [
        {
          id: 'con:product',
          name: 'Product',
          means: 'Something a customer can buy.',
          born_in: 'svc:products',
          aka: [
            { in: 'svc:products', as: 'Product', at: 'sch:product' },
            { in: 'svc:search-indexer', as: 'SearchDoc', at: 'sch:search-doc' },
          ],
        },
        {
          id: 'con:dispatch-date',
          name: 'Dispatch date',
          means: 'The day a product leaves the warehouse. Counted in working days.',
          born_in: 'svc:products',
          part_of: 'con:product',
          aka: [{ in: 'svc:products', as: 'dispatch_days', at: 'sch:product#dispatch_days' }],
          introduced_by: ['chg:dispatch-field'],
        },
      ],
    },
    changes: [
      {
        id: 'chg:dispatch-field',
        title: 'Products carry the days until dispatch',
        why: 'The date is born where the product is.',
        decisions: ['dec:days-not-dates'],
        ops: [
          {
            add: 'field',
            into: 'sch:product',
            value: { name: 'dispatch_days', type: 'int', required: true, default: 2 },
          },
          { modify: 'sch:product#price_cents', set: { required: false } },
          {
            modify: 'flow:publish-product#save',
            set: { logic: 'The merchandiser enters the dispatch days with the price.' },
          },
        ],
      },
      {
        id: 'chg:product-changed-v2',
        title: 'Publish product.changed v2 next to v1',
        why: 'Readers need the days; v1 cannot grow a required field.',
        decisions: ['dec:publish-side-by-side'],
        ops: [
          {
            add: 'schema',
            value: {
              id: 'sch:product-changed-v2',
              name: 'product.changed v2',
              kind: 'payload',
              fields: [
                { name: 'sku', type: 'string', required: true },
                { name: 'dispatch_days', type: 'int', required: true },
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
              consumers: ['svc:search-indexer', 'svc:order-api'],
              key: 'sku',
              supersedes: 'msg:product-changed',
            },
          },
          {
            add: 'step',
            into: 'flow:publish-product',
            value: {
              id: 'flow:publish-product#announce-v2',
              from: 'svc:products',
              to: 'st:product-events',
              via: 'msg:product-changed-v2',
              action: 'Announce the change as v2',
            },
          },
          { deprecate: 'msg:product-changed', replaced_by: 'msg:product-changed-v2' },
          { deprecate: 'sch:product-changed-v1', replaced_by: 'sch:product-changed-v2' },
        ],
      },
      {
        id: 'chg:indexer-reads-v2',
        title: 'The search indexer reads v2 and keeps the words as a list',
        ops: [
          { modify: 'flow:publish-product#index', set: { via: 'msg:product-changed-v2' } },
          { modify: 'sch:search-doc#words', set: { type: 'string[]' } },
        ],
      },
      {
        id: 'chg:orders-read-dispatch',
        title: 'The order API keeps the dispatch days of each product',
        ops: [
          {
            add: 'step',
            into: 'flow:publish-product',
            value: {
              id: 'flow:publish-product#orders',
              from: 'st:product-events',
              to: 'svc:order-api',
              via: 'msg:product-changed-v2',
              action: 'Keep the dispatch days',
            },
          },
          {
            add: 'field',
            into: 'sch:order',
            value: { name: 'dispatch_days', type: 'int', required: true },
          },
        ],
      },
      {
        id: 'chg:shop-shows-date',
        title: 'The product page shows the dispatch date',
        ops: [
          {
            modify: 'scr:product-page#buy',
            set: { shows: 'The price, and the day the product ships.' },
          },
        ],
      },
      {
        id: 'chg:retire-v1',
        title: 'Stop publishing product.changed v1',
        ops: [
          { remove: 'flow:publish-product#announce' },
          { remove: 'msg:product-changed' },
          { remove: 'sch:product-changed-v1' },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:dispatch-unit',
        level: 'unit',
        name: 'A product saves its dispatch days',
        proves: ['chg:dispatch-field'],
        walks: ['flow:publish-product#save'],
        owner: 'team:catalogue',
        env: 'ci',
      },
      {
        id: 'tst:indexer-contract',
        level: 'contract',
        name: 'The indexer reads v2',
        proves: ['chg:product-changed-v2', 'chg:indexer-reads-v2'],
        walks: ['flow:publish-product#index'],
        owner: 'team:catalogue',
        env: 'ci',
      },
      {
        id: 'tst:orders-contract',
        level: 'contract',
        name: 'The order API reads v2',
        proves: ['chg:orders-read-dispatch'],
        walks: ['flow:publish-product#orders'],
        owner: 'team:orders',
        env: 'ci',
      },
      {
        id: 'tst:shop-e2e',
        level: 'e2e',
        name: 'A customer sees when a product ships',
        proves: ['chg:shop-shows-date'],
        walks: ['flow:place-order#submit'],
        owner: 'team:web',
        env: 'staging',
      },
      {
        id: 'tst:no-v1-left',
        level: 'integration',
        name: 'Nothing publishes v1',
        proves: ['chg:retire-v1'],
        walks: ['flow:publish-product#announce-v2'],
        owner: 'team:catalogue',
        env: 'staging',
      },
    ],
    milestones: [
      {
        id: 'ms:m1',
        name: 'M1 · Dates exist',
        exit: 'Every product has dispatch days.',
        due: '2026-11-13',
      },
      { id: 'ms:m2', name: 'M2 · Readers move', due: '2026-11-27' },
      { id: 'ms:m3', name: 'M3 · The shop shows it', due: '2026-12-11' },
      { id: 'ms:m4', name: 'M4 · v1 is gone', due: '2027-01-15' },
    ],
    work_items: [
      {
        id: 'wi:dispatch-field',
        title: 'Dispatch days on the product',
        team: 'team:catalogue',
        size: 'S',
        milestone: 'ms:m1',
        implements: ['chg:dispatch-field'],
        verified_by: ['tst:dispatch-unit'],
        repo: 'acme/products',
      },
      {
        id: 'wi:publish-v2',
        title: 'Publish product.changed v2',
        team: 'team:catalogue',
        size: 'M',
        milestone: 'ms:m1',
        implements: ['chg:product-changed-v2'],
        depends_on: ['wi:dispatch-field'],
        repo: 'acme/products',
      },
      {
        id: 'wi:indexer-v2',
        title: 'Index from v2',
        team: 'team:catalogue',
        size: 'S',
        milestone: 'ms:m2',
        implements: ['chg:indexer-reads-v2'],
        verified_by: ['tst:indexer-contract'],
        depends_on: ['wi:publish-v2'],
        repo: 'acme/search',
      },
      {
        id: 'wi:orders-v2',
        title: 'Keep dispatch days on orders',
        team: 'team:orders',
        size: 'XL',
        milestone: 'ms:m2',
        implements: ['chg:orders-read-dispatch'],
        verified_by: ['tst:orders-contract'],
        depends_on: ['wi:publish-v2'],
        repo: 'acme/ordering',
      },
      {
        id: 'wi:shop-date',
        title:
          'Show the dispatch date on the product page beside the price, in every region and language',
        team: 'team:web',
        size: 'M',
        milestone: 'ms:m3',
        implements: ['chg:shop-shows-date'],
        verified_by: ['tst:shop-e2e'],
        depends_on: ['wi:indexer-v2'],
        repo: 'acme/shop',
      },
      {
        id: 'wi:retire-v1',
        title: 'Remove product.changed v1',
        team: 'team:catalogue',
        size: 'S',
        milestone: 'ms:m4',
        implements: ['chg:retire-v1'],
        verified_by: ['tst:no-v1-left'],
        depends_on: ['wi:indexer-v2', 'wi:orders-v2'],
        repo: 'acme/products',
      },
    ],
    decisions: [
      {
        id: 'dec:days-not-dates',
        title: 'Store days, not dates',
        status: 'accepted',
        decider: 'team:catalogue',
        decided_on: '2026-09-28',
        reversibility: 'two-way',
        options: [{ name: 'Store a date', why_not: 'It goes stale every night.' }],
      },
      {
        id: 'dec:publish-side-by-side',
        title: 'Publish v2 next to v1 until every reader moves',
        status: 'accepted',
        decider: 'team:catalogue',
        decided_on: '2026-09-29',
        reversibility: 'one-way',
        options: [
          {
            name: 'Switch every reader at once',
            why_not: 'Three teams would have to release together.',
          },
        ],
      },
    ],
    questions: [
      {
        id: 'q:which-regions',
        question: 'Which regions show a date first?',
        status: 'open',
        decider: 'team:web',
        decide_by: '2026-11-06',
        blocks: ['wi:shop-date'],
      },
    ],
    risks: [
      {
        id: 'risk:late-readers',
        statement: 'A reader is still on v1 when it is removed.',
        likelihood: 'low',
        impact: 'high',
        roam: 'mitigated',
        owner: 'team:catalogue',
        mitigation: 'v1 is removed only once both readers are on v2.',
        about: ['msg:product-changed'],
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function dispatchDate(): Plan {
  return planOnAcme(dispatchDateOverlay()).plan;
}
