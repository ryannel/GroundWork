import type { Model } from '@/application/plan/derive';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import type { ResponsePolicy } from '@/application/plan/federation-policy';

// The waterfall against today's: which fetches of the to-be plan are new, which moved to another subgraph, which are gone.

export interface FetchChange {
  readonly kind: 'add' | 'moved' | 'gone';
  /** The subgraph the fetch's fields came from, when it moved. */
  readonly was?: string;
}

export interface Before {
  readonly roundTrips: number;
  readonly fetches: number;
  readonly teams: number;
  readonly plan: QueryPlan;
  readonly policy: ResponsePolicy;
}

export interface Comparison {
  /** Today's plan for the operation; null when it is new. */
  readonly before: Before | null;
  readonly changes: ReadonlyMap<string, FetchChange>;
  readonly gone: readonly Fetch[];
}

/** The fetch of the before plan that held most of this fetch's own fields, by id. */
function heldMost(fetch: Fetch, owner: ReadonlyMap<string, Fetch>): Fetch | undefined {
  const tally = new Map<Fetch, number>();
  for (const field of fetch.fields.filter((x) => !fetch.keyFields.includes(x))) {
    const was = owner.get(field);
    if (was !== undefined) tally.set(was, (tally.get(was) ?? 0) + 1);
  }
  return [...tally].toSorted((a, b) => b[1] - a[1])[0]?.[0];
}

/** Compares the after plan with the before plan. */
export function compare(model: Model, id: string, after: QueryPlan): Comparison {
  if (!model.asIs.has(id)) {
    return {
      before: null,
      changes: new Map(after.fetches.map((f) => [f.id, { kind: 'add' }])),
      gone: [],
    };
  }
  const plan = model.queryPlan(id, 'asIs');
  const owner = new Map(plan.fetches.flatMap((f) => f.fields.map((field) => [field, f] as const)));
  const changes = new Map<string, FetchChange>();
  const used = new Set<Fetch>();
  for (const fetch of after.fetches) {
    const was = heldMost(fetch, owner);
    if (was === undefined) changes.set(fetch.id, { kind: 'add' });
    else {
      used.add(was);
      if (was.subgraph !== fetch.subgraph) {
        changes.set(fetch.id, { kind: 'moved', was: was.subgraph });
      }
    }
  }
  const gone = plan.fetches.filter(
    (f) => !used.has(f) && !after.fetches.some((a) => a.subgraph === f.subgraph),
  );
  const before: Before = {
    roundTrips: plan.roundTrips,
    fetches: plan.fetches.length,
    teams: plan.teams.length,
    plan,
    policy: model.responsePolicy(id, 'asIs'),
  };
  return { before, changes, gone };
}
