import type { CheckContext, Report } from '@/application/plan/check-context';
import { checkOperations } from '@/application/plan/check-federation-ops';
import { createScopes, type Scope } from '@/application/plan/check-federation-scope';
import { checkGraphTypes } from '@/application/plan/check-federation-types';
import { invalidators } from '@/application/plan/federation-policy';
import { parentOf } from '@/application/plan/ids';
import type { OpRecord, StoreNode } from '@/domain/plan/plan-graph';

/** Check 15: a subgraph is served by an ordinary backend service, not the gateway. */
function checkSubgraphs(s: Scope): void {
  for (const sg of s.g.subgraphs) {
    const svc = s.g.get(sg.service);
    if (svc?.$type === 'service' && (svc.kind === 'ui' || svc.kind === 'external')) {
      s.warn(
        s.at(sg, 'service'),
        `${sg.id} is served by ${svc.id}, a ${svc.kind} service; point service at the backend service that runs the subgraph`,
      );
    }
    const gateway = s.g.get(sg.graph);
    const gw = gateway?.$type === 'graph' ? gateway.gateway : '';
    if (gw !== '' && sg.service === gw) {
      s.warn(
        s.at(sg, 'service'),
        `${sg.id} is served by ${gw}, the gateway of ${sg.graph}; a subgraph is served by its own service (model the gateway's own fields as a subgraph of a separate service)`,
      );
    }
  }
}

type GraphNode = Scope['g']['graphs'][number];

function checkRoots(s: Scope, gr: GraphNode): void {
  const types = s.g.schemas.filter((t) => t.kind === 'graph-type' && t.graph === gr.id);
  if (!types.some((t) => t.root === 'query')) {
    s.error(
      s.at(gr),
      `${gr.id} has no Query type; add a kind: graph-type schema with graph: ${gr.id} and root: query (its fields are the root fields and the subgraphs that own them)`,
    );
  }
  for (const r of ['query', 'mutation'] as const) {
    for (const t of types.filter((x) => x.root === r).slice(1)) {
      s.error(
        s.at(t, 'root'),
        `${gr.id} already has a root: ${r} type; a graph has exactly one ${r === 'query' ? 'Query' : 'Mutation'} type, so merge ${t.id} into it`,
      );
    }
  }
}

/** A gateway's GraphQL interface carries operations, not endpoints. */
function checkGatewayInterface(s: Scope, gr: GraphNode): void {
  if (!s.g.operations.some((o) => o.graph === gr.id)) return;
  for (const i of s.g.interfaces) {
    if (i.service !== gr.gateway || i.protocol !== 'graphql' || i.endpoints.length === 0) continue;
    s.warn(
      s.at(i, 'endpoints'),
      `${i.id} is the GraphQL interface of ${gr.id}'s gateway but lists endpoints; model them as operations (gql:…) and remove the endpoints`,
    );
  }
}

interface Purge {
  s: Scope;
  st: StoreNode;
  writers: Set<string>;
  heard: string[];
}

function checkPurge({ s, st, writers, heard }: Purge, mid: string, i: number): void {
  const m = s.g.get(mid);
  if (m?.$type !== 'message') return;
  const at = s.at(st, 'invalidated_by', ['invalidated_by', i]);
  if (!(m.consumers ?? []).some((c) => writers.has(c))) {
    s.warn(
      at,
      `${st.id} says ${mid} purges it, but neither its owner (${st.owner}) nor a service with write access consumes ${mid}; append the purging service to ${mid}.consumers and give it write access`,
      `${mid}|no-consumer`,
    );
  }
  if (!heard.includes(mid)) {
    s.warn(
      at,
      `${st.id} says ${mid} purges it, but no flow step that hears ${mid} purges it; add a step with purges: [${st.id}] after the step that consumes ${mid}`,
      `${mid}|no-step`,
    );
  }
}

/** Check 22: who empties a cache. */
function checkCaches(s: Scope): void {
  for (const st of s.g.stores) {
    if (st.kind !== 'cache') continue;
    const writers = new Set([
      st.owner,
      ...(st.access ?? []).filter((a) => a.mode.includes('write')).map((a) => a.svc),
    ]);
    const purge = { s, st, writers, heard: invalidators(s.g, st.id).fromSteps };
    for (const [i, mid] of (st.invalidated_by ?? []).entries()) checkPurge(purge, mid, i);
  }
}

function hasUsage(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'usage' in value && value.usage !== undefined
  );
}

/** Is the record a retirement of a graph-type field that cites no usage evidence? */
function retiresWithoutUsage(ctx: CheckContext, rec: OpRecord): boolean {
  if (rec.type !== 'field' || rec.problems.length > 0 || rec.target === null) return false;
  const field = ctx.asIs.get(rec.target) ?? ctx.toBe.get(rec.target) ?? rec.removed;
  const parent = parentOf(rec.target);
  const type = ctx.asIs.get(parent) ?? ctx.toBe.get(parent);
  return type?.$type === 'schema' && type.kind === 'graph-type' && !hasUsage(field);
}

/** Retiring a graph field needs evidence that nobody still asks for it. */
function checkUsageEvidence(ctx: CheckContext, rep: Report): void {
  for (const rec of ctx.applied.records) {
    if (rec.kind !== 'deprecate' && rec.kind !== 'remove') continue;
    if (!retiresWithoutUsage(ctx, rec)) continue;
    rep.warn(
      [...rec.path, rec.kind],
      `${String(rec.target)} is ${rec.kind === 'remove' ? 'removed' : 'deprecated'} with no usage evidence; add usage: { clients, per_day, last_seen, source } from the schema registry to the field first`,
    );
  }
}

/** Checks 15–22: federated graphs: subgraphs, graph types, operations and caches. */
export function checkFederation(ctx: CheckContext, rep: Report): void {
  for (const s of createScopes(ctx, rep)) {
    checkSubgraphs(s);
    for (const gr of s.g.graphs) {
      checkRoots(s, gr);
      checkGatewayInterface(s, gr);
    }
    checkGraphTypes(s);
    checkOperations(s);
    checkCaches(s);
  }
  checkUsageEvidence(ctx, rep);
}
