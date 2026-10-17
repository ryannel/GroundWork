// The federated shop graph as the journey, today and ladder tests read it: the shop fixture with a cache that says
// how it is purged, an operation whose cache rule only repeats the graph's own, and milestones for the price move.
import { shop } from '@/../test/federation-kit';
import type { Plan } from '@/domain/plan/plan.generated';

function find<T extends { readonly id: string }>(list: readonly T[] | undefined, id: string): T {
  const found = list?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id} in the shop`);
  return found;
}

/** A fresh, mutable shop graph plan every call. */
export function shopGraph(): Plan {
  const plan = shop();
  find(plan.stores, 'st:edge-cache').purge = 'surrogate key per sku, sent by the purger';
  // The same time the graph's rules give, and no reason: an override that says nothing new.
  find(plan.operations, 'gql:search-reviews').cache = [{ at: 'st:edge-cache', ttl: 600 }];
  plan.milestones = [
    {
      id: 'ms:m1',
      name: 'M1 · Pricing v2 serves',
      exit: 'Pricing v2 answers a tenth of the traffic.',
    },
    { id: 'ms:m3', name: 'M3 · Pricing v2 alone', exit: 'Pricing no longer resolves the price.' },
  ];
  plan.work_items = [
    {
      id: 'wi:promise',
      title: 'Promise subgraph',
      team: 'team:fulfil',
      implements: ['chg:promise'],
    },
    {
      id: 'wi:pricing-v2',
      title: 'Pricing v2',
      team: 'team:pricing',
      milestone: 'ms:m1',
      implements: ['chg:price-expand', 'chg:price-migrate'],
    },
    {
      id: 'wi:pricing-v1-off',
      title: 'Pricing stops serving price',
      team: 'team:pricing',
      milestone: 'ms:m3',
      implements: ['chg:price-contract'],
      depends_on: ['wi:pricing-v2'],
    },
  ];
  return plan;
}
