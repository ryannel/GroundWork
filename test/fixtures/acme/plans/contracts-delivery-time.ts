// A plan about contracts on Acme: the product record gains a delivery time and a weight, `name` gives way to
// `title`, reading a product needs staff sign-in, and the catalogue keeps delivery times in a store of their own.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as written in plans/delivery-time/plan.yaml. */
function deliveryTimeOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'delivery-time',
      title: 'Show the delivery time on the product page',
      version: '1.0',
      date: '2026-05-25',
      status: 'draft',
      authors: ['Catalogue'],
      repos: ['acme/products'],
    },
    problem: {
      summary: 'Customers cannot see when a product arrives; see [[sch:product]].',
      why: 'Every third support question asks when an order will arrive.',
      goals: ['Show the delivery time of every product'],
    },
    context: ['flow:place-order', 'if:search-rest', 'if:payments-rest', 'if:card-provider'],
    changes: [
      {
        id: 'chg:product-delivery',
        title: 'The product record carries its delivery time and weight',
        why: 'The product page needs the time; shipping needs the weight.',
        ops: [
          {
            add: 'field',
            into: 'sch:product',
            value: { name: 'title', type: 'string', required: true, note: 'Replaces `name`.' },
          },
          {
            add: 'field',
            into: 'sch:product',
            value: { name: 'lead_days', type: 'int', required: true },
          },
          { add: 'field', into: 'sch:product', value: { name: 'weight_g', type: 'int' } },
          { modify: 'sch:product#price_cents', set: { note: 'Including VAT.' } },
          { deprecate: 'sch:product#name', replaced_by: 'sch:product#title' },
          { modify: 'api:products-get', set: { auth: 'staff SSO' } },
        ],
      },
      {
        id: 'chg:delivery-store',
        title: 'Keep delivery times in a store of their own',
        ops: [
          {
            add: 'store',
            value: {
              id: 'st:delivery-times',
              name: 'delivery-times',
              kind: 'database',
              tech: 'Postgres 16 via JDBC; one table per region',
              owner: 'svc:products',
              does: 'How long each product takes to arrive',
            },
          },
          {
            add: 'schema',
            value: {
              id: 'sch:delivery-time',
              name: 'DeliveryTime',
              kind: 'record',
              store: 'st:delivery-times',
              fields: [
                { name: 'sku', type: 'string', required: true, key: true },
                { name: 'days', type: 'int', required: true },
              ],
            },
          },
          {
            add: 'step',
            into: 'flow:publish-product',
            after: 'flow:publish-product#save',
            value: {
              id: 'flow:publish-product#time',
              from: 'svc:products',
              to: 'st:delivery-times',
              via: 'internal',
              action: 'Store the delivery time',
              writes: ['sch:delivery-time'],
            },
          },
        ],
      },
      {
        id: 'chg:drop-name',
        title: 'Stop sending the old name',
        ops: [{ remove: 'sch:product#name' }],
      },
    ],
    tests: [
      {
        id: 'tst:product-contract',
        level: 'contract',
        name: 'Product contract',
        proves: ['chg:product-delivery', 'chg:delivery-store', 'chg:drop-name'],
        walks: ['flow:publish-product#time'],
        owner: 'team:catalogue',
        env: 'ci',
      },
    ],
    work_items: [
      {
        id: 'wi:delivery-time',
        title: 'Delivery time on the product',
        team: 'team:catalogue',
        size: 'M',
        implements: ['chg:product-delivery', 'chg:delivery-store', 'chg:drop-name'],
        verified_by: ['tst:product-contract'],
        repo: 'acme/products',
      },
    ],
  };
}

/** The overlay on Acme's today, as the app draws it. */
export function deliveryTime(): Plan {
  return planOnAcme(deliveryTimeOverlay()).plan;
}
