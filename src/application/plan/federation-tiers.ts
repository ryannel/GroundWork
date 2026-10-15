import { LAYERS, graphIndex, storeNode } from '@/application/plan/federation-index';
import type { QueryPlan } from '@/application/plan/federation-plan-types';
import {
  fetchMaxAge,
  invalidators,
  privacyOf,
  type ResponsePolicy,
} from '@/application/plan/federation-policy';
import type {
  FieldNode,
  OperationNode,
  PlanNode,
  StoreNode,
  SystemGraph,
} from '@/domain/plan/plan-graph';
import type { CacheUse, Store } from '@/domain/plan/plan.generated';

export type RowState = 'hit' | 'miss' | 'skipped' | 'blocked';

export interface PerFetch {
  fetch: string;
  subgraph: string;
  ttl: number;
  cacheable: boolean;
  state: RowState;
}

/** A cache row before the case is settled: it may carry the reason it is blocked. */
export interface Draft {
  store: string;
  name: string;
  layer: 'edge' | 'gateway' | 'subgraph';
  key: NonNullable<CacheUse['key']> | null;
  invalidatedBy: string[];
  purgedIn: string[];
  stale: Store['stale'] | null;
  observed: Store['observed'] | null;
  granularity: 'response' | 'entity' | 'data';
  ttl: number | null;
  /** Authored and differs from the derived max-age; authored and equal; derived; per field; per fetch. */
  ttlSource: 'override' | 'authored' | 'derived' | 'field' | 'per-fetch';
  derivedTtl?: number;
  scope: 'public' | 'private';
  reason: string | null;
  state: RowState;
  blocked?: string;
  fetch?: string;
  fields?: string[];
  perFetch?: PerFetch[];
}

const onPath = (st: PlanNode | undefined): st is StoreNode & { layer: Draft['layer'] } =>
  st?.$type === 'store' &&
  st.kind === 'cache' &&
  st.layer !== undefined &&
  LAYERS.includes(st.layer);

function base(g: SystemGraph, st: StoreNode, layer: Draft['layer']): Draft {
  const inv = invalidators(g, st.id);
  return {
    store: st.id,
    name: st.name,
    layer,
    key: st.keyed_by ?? null,
    invalidatedBy: inv.messages,
    purgedIn: inv.steps,
    stale: st.stale ?? null,
    observed: st.observed ?? null,
    granularity: 'data',
    ttl: null,
    ttlSource: 'field',
    scope: 'public',
    reason: null,
    state: 'skipped',
  };
}

/** Every edge or gateway cache on the way to the operation's graph, outermost first. */
function responseStores(g: SystemGraph, op: OperationNode): ResponseStore[] {
  const idx = graphIndex(g, op.graph);
  const found = new Map<string, ResponseStore>();
  const add = (st: PlanNode | undefined): void => {
    if (onPath(st) && st.layer !== 'subgraph') found.set(st.id, st);
  };
  for (const o of idx.operations) for (const c of o.cache ?? []) add(storeNode(g, c.at));
  for (const st of g.stores) if (idx.gateway !== null && st.owner === idx.gateway) add(st);
  for (const c of op.cache ?? []) add(storeNode(g, c.at));
  return [...found.values()].toSorted((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer));
}

export interface TierFacts {
  g: SystemGraph;
  op: OperationNode;
  plan: QueryPlan;
  policy: ResponsePolicy;
}

function blockReason(f: TierFacts, row: Draft): string | undefined {
  const { plan, policy, op } = f;
  if (plan.kind === 'mutation') return 'a mutation is never cached';
  if (row.granularity === 'entity') {
    return row.perFetch?.some((p) => p.cacheable) === true
      ? undefined
      : 'no fetch has a max-age above 0';
  }
  if (policy.scope === 'private') return policy.why;
  if (row.layer === 'edge' && policy.method !== 'GET') {
    return `the edge does not cache POST; ${op.name} needs GET with a persisted id`;
  }
  return (row.ttl ?? 0) > 0 ? undefined : policy.why;
}

type ResponseStore = StoreNode & { layer: Draft['layer'] };

function entityRow(f: TierFacts, row: Draft): Draft {
  const perFetch = f.plan.fetches.map((x): PerFetch => {
    const ttl = fetchMaxAge(f.g, f.op.id, x);
    return { fetch: x.id, subgraph: x.subgraph, ttl, cacheable: ttl > 0, state: 'skipped' };
  });
  return { ...row, granularity: 'entity', ttlSource: 'per-fetch', perFetch };
}

function ttlSource(own: CacheUse | undefined, maxAge: number): Draft['ttlSource'] {
  if (own?.ttl === undefined) return 'derived';
  // the plan's own ttl is an override only when it differs from what the cache rules give
  return own.ttl === maxAge ? 'authored' : 'override';
}

function responseRow(f: TierFacts, st: ResponseStore): Draft {
  const { g, op, policy } = f;
  const own = (op.cache ?? []).find((x) => x.at === st.id);
  const row: Draft = {
    ...base(g, st, st.layer),
    key: own?.key ?? st.keyed_by ?? null,
    scope: policy.scope,
    reason: own?.reason ?? null,
  };
  const settled: Draft =
    st.granularity === 'entity'
      ? entityRow(f, row)
      : {
          ...row,
          granularity: 'response',
          ttl: own?.ttl ?? policy.maxAge,
          ttlSource: ttlSource(own, policy.maxAge),
          derivedTtl: policy.maxAge,
        };
  const blocked = blockReason(f, settled);
  return blocked === undefined ? settled : { ...settled, blocked };
}

/** The edge and gateway rows in front of an operation, one per cache; a row it cannot use stays, blocked. */
export function responseTiers(f: TierFacts): Draft[] {
  return responseStores(f.g, f.op).map((st) => responseRow(f, st));
}

/** The data caches inside an operation's fetches. */
export function operationDataTier(f: TierFacts): Draft[] {
  const rows: Draft[] = [];
  for (const fetch of f.plan.fetches) {
    for (const c of fetch.caches) {
      const st = storeNode(f.g, c.at);
      if (!onPath(st)) continue;
      const cur = rows.find((r) => r.store === st.id && r.fetch === fetch.id);
      if (cur?.fields === undefined) {
        rows.push({
          ...base(f.g, st, 'subgraph'),
          ttl: c.ttl,
          scope: f.policy.scope,
          fetch: fetch.id,
          fields: [c.field],
        });
      } else if (!cur.fields.includes(c.field)) cur.fields.push(c.field);
    }
  }
  return rows;
}

/** The data caches behind one graph field. */
export function fieldDataTier(g: SystemGraph, fd: FieldNode): Draft[] {
  return (fd.cache ?? []).flatMap((c) => {
    const st = storeNode(g, c.at);
    if (!onPath(st)) return [];
    const scope = privacyOf(fd) === null ? 'public' : 'private';
    return [
      { ...base(g, st, 'subgraph'), ttl: c.ttl ?? null, scope, fields: [fd.id] } satisfies Draft,
    ];
  });
}
