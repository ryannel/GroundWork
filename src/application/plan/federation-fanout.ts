import { uniq } from '@/application/plan/derive-values';
import { memoPerGraph, storeNode, subgraphNode } from '@/application/plan/federation-index';
import { queryPlan } from '@/application/plan/federation-plan';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import { actingService, baseFanout } from '@/application/plan/graph-queries';
import { parentOf } from '@/application/plan/ids';
import type {
  FanoutCall,
  FanoutRead,
  FanoutResult,
  OperationNode,
  StepNode,
  SystemGraph,
} from '@/domain/plan/plan-graph';

/** A call the gateway makes for an operation: which fetch and field it serves, and the share a minority gets. */
export interface FederatedCall extends FanoutCall {
  readonly fetch?: string;
  readonly field?: string;
  /** Percent of requests that go to the minority subgraph of a progressive @override. */
  readonly share?: number;
}

export interface FederatedFanout extends FanoutResult {
  readonly calls: readonly FederatedCall[];
}

const results = memoPerGraph<FederatedFanout>();

const isTopic = (kind: string | undefined): boolean => kind === 'topic' || kind === 'queue';

/** The record store a record reference lives in; a topic or queue is not one. */
function storeOfRef(g: SystemGraph, ref: string): string | null {
  const sch = g.get(parentOf(ref) ?? ref);
  const store = sch?.$type === 'schema' && sch.store !== undefined ? g.get(sch.store) : undefined;
  return store?.$type === 'store' && !isTopic(store.kind) ? store.id : null;
}

function subgraphCalls(plan: QueryPlan, gateway: string, opId: string): FederatedCall[] {
  const seen = new Set<string>();
  const calls: FederatedCall[] = [];
  for (const f of plan.fetches) {
    if (f.service === null || seen.has(f.service)) continue;
    seen.add(f.service);
    calls.push({
      from: gateway,
      to: f.service,
      via: opId,
      kind: 'api',
      fanout: true,
      subgraph: f.subgraph,
      fetch: f.id,
    });
  }
  return calls;
}

/**
 * A progressive @override sends a share of the traffic to the other subgraph: the plan is drawn on the majority
 * side, so add the call to the minority one.
 */
function minorityCalls(
  g: SystemGraph,
  plan: QueryPlan,
  at: { readonly gateway: string; readonly opId: string },
): FederatedCall[] {
  const served = new Set(plan.fetches.map((f) => f.service));
  const calls: FederatedCall[] = [];
  const progressive = plan.overrides.filter(
    (ov) => ov.percent > 0 && ov.percent < 100 && ov.to !== null,
  );
  for (const ov of progressive) {
    const minority = ov.percent < 50 ? (ov.to ?? ov.from) : ov.from;
    const service = subgraphNode(g, minority)?.service;
    if (service === undefined || served.has(service)) continue;
    served.add(service);
    calls.push({
      from: at.gateway,
      to: service,
      via: at.opId,
      kind: 'api',
      fanout: true,
      subgraph: minority,
      share: Math.min(ov.percent, 100 - ov.percent),
      field: ov.field,
    });
  }
  return calls;
}

function viaCalls(plan: QueryPlan, known: readonly FederatedCall[]): FederatedCall[] {
  const calls = [...known];
  for (const f of plan.fetches) {
    for (const v of f.vias) {
      const already = (c: FederatedCall): boolean =>
        c.from === f.service && c.to === v.to && c.via === v.via;
      if (f.service === null || v.to === null || calls.some(already)) continue;
      calls.push({
        from: f.service,
        to: v.to,
        via: v.via,
        kind: 'api',
        fanout: true,
        field: v.field,
      });
    }
  }
  return calls.slice(known.length);
}

function gatewayCalls(g: SystemGraph, step: StepNode, op: OperationNode): FederatedCall[] {
  const plan = queryPlan(g, op.id);
  const gateway = plan.gateway ?? step.to;
  const first: FederatedCall = {
    from: step.from,
    to: step.to,
    via: op.id,
    kind: 'api',
    fanout: false,
  };
  const known = [
    first,
    ...subgraphCalls(plan, gateway, op.id),
    ...minorityCalls(g, plan, { gateway, opId: op.id }),
  ];
  return [...known, ...viaCalls(plan, known)];
}

function readRows(g: SystemGraph, f: Fetch, data: readonly FanoutRead[]): FanoutRead[] {
  const rows: FanoutRead[] = [];
  for (const r of f.reads) {
    if (r.svc === null || [...data, ...rows].some((d) => d.svc === r.svc && d.ref === r.ref)) {
      continue;
    }
    const store = r.store !== null && !isTopic(storeNode(g, r.store)?.kind) ? r.store : null;
    rows.push({ svc: r.svc, ref: r.ref, store, rw: 'read', field: r.field });
  }
  return rows;
}

function cacheRows(f: Fetch, data: readonly FanoutRead[]): FanoutRead[] {
  const rows: FanoutRead[] = [];
  for (const x of f.caches) {
    if (
      [...data, ...rows].some((d) => d.svc === f.service && d.store === x.at && d.cache === true)
    ) {
      continue;
    }
    rows.push({ svc: f.service, ref: null, store: x.at, rw: 'read', field: x.field, cache: true });
  }
  return rows;
}

function dataBehind(g: SystemGraph, op: OperationNode): FanoutRead[] {
  const plan = queryPlan(g, op.id);
  const data: FanoutRead[] = [];
  for (const f of plan.fetches) {
    const reads = readRows(g, f, data);
    data.push(...reads, ...cacheRows(f, [...data, ...reads]));
  }
  const root = plan.fetches.find((f) => f.kind === 'root');
  if (plan.kind === 'mutation' && root !== undefined) {
    for (const ref of op.writes ?? []) {
      data.push({ svc: root.service, ref, store: storeOfRef(g, ref), rw: 'write' });
    }
  }
  return data;
}

function operationFanout(g: SystemGraph, step: StepNode, op: OperationNode): FederatedFanout {
  const plan = queryPlan(g, op.id);
  const calls = gatewayCalls(g, step, op);
  const data = dataBehind(g, op);
  const fields = uniq(plan.selected.map((s) => s.field));
  const subgraphs = uniq(plan.fetches.map((f) => f.subgraph));
  const refs = uniq([
    op.id,
    ...fields,
    ...fields.map(parentOf),
    ...subgraphs,
    ...data.map((d) => d.ref),
    ...data.filter((d) => d.cache === true).map((d) => d.store),
    ...(op.cache ?? []).map((x) => x.at),
  ]);
  const isSvc = (id: string): boolean => g.get(id)?.$type === 'service';
  const services = uniq(
    [step.from, step.to, ...calls.flatMap((c) => [c.from, c.to])].filter(isSvc),
  );
  const actor = actingService(g, step);
  const purges = (step.purges ?? []).map((store) => ({ svc: actor, store }));
  return { calls, data, purges, refs, services, subgraphs, operation: op.id };
}

function stepFanout(g: SystemGraph, step: StepNode): FederatedFanout {
  const op = g.get(step.via);
  if (op?.$type === 'operation') return operationFanout(g, step, op);
  const base = baseFanout(g, step);
  return { ...base, services: uniq(base.services) };
}

/**
 * What a step reaches once its `via` is expanded. For an api, msg or internal step that is the step itself; for a
 * step that calls an operation it is the derived fan-out: client → gateway, gateway → each subgraph service,
 * each field `via` hop, the reads behind the selected fields and a mutation's writes.
 */
export function federatedFanout(g: SystemGraph, step: StepNode): FederatedFanout {
  return results(g, `fanout|${step.id}|${step.via}|${step.from}|${step.to}`, () =>
    stepFanout(g, step),
  );
}
