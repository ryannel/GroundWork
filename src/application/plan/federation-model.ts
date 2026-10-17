import type { Core } from '@/application/plan/derive-core';
import { memo, uniq } from '@/application/plan/derive-values';
import {
  type Blast,
  blastRadius,
  type FieldOwners,
  fieldOwners,
} from '@/application/plan/federation-blast';
import { type CacheCase, type CachePath, cachePath } from '@/application/plan/federation-cache';
import { type FederatedFanout, federatedFanout } from '@/application/plan/federation-fanout';
import { queryPlan } from '@/application/plan/federation-plan';
import type { QueryPlan } from '@/application/plan/federation-plan-types';
import { type ResponsePolicy, responsePolicy } from '@/application/plan/federation-policy';
import { parentOf, typeOf } from '@/application/plan/ids';
import type { SystemGraph } from '@/domain/plan/plan-graph';

export interface PlanSummary {
  readonly fetches: number;
  readonly roundTrips: number;
  readonly subgraphs: readonly string[];
  readonly maxAge: number;
  readonly scope: 'public' | 'private';
  readonly cacheable: boolean;
}

type ByMode<R> = (id: string, mode?: string) => R;

export interface FederationQueries {
  readonly queryPlan: ByMode<QueryPlan>;
  readonly responsePolicy: ByMode<ResponsePolicy>;
  readonly cachePath: (id: string, mode?: string, kase?: string) => CachePath;
  readonly blastRadius: ByMode<readonly Blast[]>;
  readonly fieldOwners: ByMode<FieldOwners>;
  readonly fanoutOf: ByMode<FederatedFanout | undefined>;
  readonly teamsBehind: ByMode<readonly string[]>;
  readonly planSummary: ByMode<PlanSummary | null>;
}

export interface OperationLookups {
  readonly operationsOf: ByMode<readonly string[]>;
  readonly operationsSelecting: ByMode<readonly string[]>;
  readonly operationsOn: ByMode<readonly string[]>;
}

const cacheCase = (kase: string | undefined): CacheCase =>
  kase === 'hit' || kase === 'miss' ? kase : 'cold';

/** Queries over the federated graphs; each takes a mode (default to-be) and is memoised. */
export function createFederation(core: Core): FederationQueries {
  const { asIs, toBe } = core;
  const graphFor = (mode: string | undefined): SystemGraph => core.graphOf(mode);

  const queryPlanIn = memo((opId: string, mode?: string) => queryPlan(graphFor(mode), opId));
  const responsePolicyIn = memo((opId: string, mode?: string) =>
    responsePolicy(graphFor(mode), opId),
  );
  const cachePathIn = memo((id: string, mode?: string, kase?: string) =>
    cachePath(graphFor(mode), id, cacheCase(kase)),
  );
  const blastRadiusIn = memo((opId: string, mode?: string) => blastRadius(graphFor(mode), opId));
  const fieldOwnersIn = memo((typeId: string, mode?: string) =>
    fieldOwners(graphFor(mode), typeId),
  );

  /** What a step reaches once its via is expanded, in the graph holding the step (the other one if only there). */
  const fanoutOf = memo((stepId: string, mode?: string) => {
    const wanted = graphFor(mode);
    const g = [wanted, asIs, toBe].find((x) => x.has(stepId)) ?? wanted;
    const step = g.get(stepId);
    return step?.$type === 'step' ? federatedFanout(g, step) : undefined;
  });

  const teamsBehind = (opId: string, mode?: string): readonly string[] =>
    queryPlanIn(opId, mode).teams;

  const planSummary = (opId: string, mode?: string): PlanSummary | null => {
    if (!graphFor(mode).has(opId)) return null;
    const plan = queryPlanIn(opId, mode);
    const policy = responsePolicyIn(opId, mode);
    return {
      fetches: plan.fetches.length,
      roundTrips: plan.roundTrips,
      subgraphs: uniq(plan.fetches.map((f) => f.subgraph)),
      maxAge: policy.maxAge,
      scope: policy.scope,
      cacheable: policy.cacheable,
    };
  };

  return {
    queryPlan: queryPlanIn,
    responsePolicy: responsePolicyIn,
    cachePath: cachePathIn,
    blastRadius: blastRadiusIn,
    fieldOwners: fieldOwnersIn,
    fanoutOf,
    teamsBehind,
    planSummary,
  };
}

type Plans = Pick<FederationQueries, 'queryPlan'>;

/** Which operations touch a screen, a field or a subgraph, by their query plans. */
export function createOperationLookups(core: Core, plans: Plans): OperationLookups {
  const graphFor = (mode: string | undefined): SystemGraph => core.graphOf(mode);
  const queryPlanIn = plans.queryPlan;

  const operationsOf = memo((id: string, mode?: string): string[] => {
    const isScreen = typeOf(id) === 'screen';
    return graphFor(mode)
      .operations.filter((o) =>
        (o.screens ?? []).some((x) => x === id || (isScreen && parentOf(x) === id)),
      )
      .map((o) => o.id);
  });

  const operationsSelecting = memo((id: string, mode?: string): string[] =>
    graphFor(mode)
      .operations.filter((o) =>
        queryPlanIn(o.id, mode).selected.some(
          (x) => x.addedByRouter === null && (x.field === id || parentOf(x.field) === id),
        ),
      )
      .map((o) => o.id),
  );

  const operationsOn = memo((sgId: string, mode?: string): string[] =>
    graphFor(mode)
      .operations.filter((o) => queryPlanIn(o.id, mode).fetches.some((f) => f.subgraph === sgId))
      .map((o) => o.id),
  );

  return { operationsOf, operationsSelecting, operationsOn };
}

export type Federation = FederationQueries & OperationLookups;
