import { uniq } from '@/application/plan/derive-values';
import { schemaNode, subgraphNode, type GraphIndex } from '@/application/plan/federation-index';
import type {
  Fetch,
  OverrideInfo,
  PlanWarningCode,
  QueryPlan,
} from '@/application/plan/federation-plan-types';
import type { TreeNode } from '@/application/plan/federation-tree';
import { parentOf } from '@/application/plan/ids';
import type { FieldNode, SystemGraph } from '@/domain/plan/plan-graph';

/** What one query-plan derivation shares while it places fields into fetches. */
export interface PlanCtx {
  g: SystemGraph;
  out: QueryPlan;
  idx: GraphIndex;
  overrides: Map<string, OverrideInfo>;
  placement: Map<TreeNode, Fetch>;
  warned: Set<string>;
  entityAt: Map<string, Fetch>;
  busy: Set<TreeNode>;
}

export function warn(
  c: PlanCtx,
  w: { code: PlanWarningCode; message: string; path?: string },
): void {
  if (c.warned.has(w.message)) return;
  c.warned.add(w.message);
  c.out.warnings.push(w.path === undefined ? { code: w.code, message: w.message } : w);
}

/** The subgraphs that own a field, honouring a progressive @override (the majority side first). */
export function ownersOf(c: PlanCtx, fd: FieldNode): string[] {
  const list = uniq(fd.subgraphs ?? []);
  const ov = fd.override;
  if (ov === null || ov === undefined || !list.includes(ov.from)) return list;
  const to = list.filter((x) => x !== ov.from);
  const percent = ov.percent ?? 100;
  c.overrides.set(fd.id, { field: fd.id, from: ov.from, to: to[0] ?? null, percent });
  if (list.length < 2) return list;
  if (percent >= 100) return to;
  return percent >= 50 ? [...to, ov.from] : [ov.from, ...to];
}

interface FetchProps {
  kind: 'root' | 'entity';
  subgraph: string;
  type: string;
  after: string[];
  path?: string;
  intermediate?: boolean;
  list?: boolean;
}

export function newFetch(c: PlanCtx, props: FetchProps): Fetch {
  const service = subgraphNode(c.g, props.subgraph)?.service ?? null;
  const f: Fetch = {
    id: `f${String(c.out.fetches.length + 1)}`,
    kind: props.kind,
    subgraph: props.subgraph,
    service,
    team: teamOf(c.g, service),
    type: props.type,
    path: props.path ?? '',
    after: props.after,
    depth: 0,
    intermediate: props.intermediate ?? false,
    fields: [],
    paths: [],
    keyFields: [],
    requiredFields: [],
    list: props.list ?? false,
    batched: false,
    nPlusOne: false,
    representations: null,
    reads: [],
    vias: [],
    caches: [],
  };
  c.out.fetches.push(f);
  return f;
}

export function teamOf(g: SystemGraph, svc: string | null): string | null {
  const n = g.get(svc);
  return n?.$type === 'service' ? n.team : null;
}

function recordVia(F: Fetch, fd: FieldNode, viaSvc: string | null): void {
  if (fd.via !== undefined && !F.vias.some((v) => v.field === fd.id)) {
    F.vias.push({ field: fd.id, via: fd.via, to: viaSvc });
  }
}

function recordReads(c: PlanCtx, F: Fetch, at: { fd: FieldNode; viaSvc: string | null }): void {
  const { fd, viaSvc } = at;
  for (const ref of fd.reads ?? []) {
    if (F.reads.some((r) => r.field === fd.id && r.ref === ref)) continue;
    const sch = schemaNode(c.g, parentOf(ref) ?? ref);
    F.reads.push({ field: fd.id, ref, store: sch?.store ?? null, svc: viaSvc ?? F.service });
  }
}

function recordCaches(F: Fetch, fd: FieldNode): void {
  for (const use of fd.cache ?? []) {
    if (!F.caches.some((x) => x.field === fd.id && x.at === use.at)) {
      F.caches.push({ field: fd.id, at: use.at, ttl: use.ttl ?? null });
    }
  }
}

/** Record that fetch F resolves node's field, with the reads, vias and caches behind it. */
export function resolveIn(
  c: PlanCtx,
  F: Fetch,
  at: { node: TreeNode; fd: FieldNode; why?: 'key' | 'requires' },
): void {
  const { node, fd } = at;
  if (!F.fields.includes(fd.id)) F.fields.push(fd.id);
  if (!F.paths.includes(node.path)) F.paths.push(node.path);
  c.placement.set(node, F);
  c.out.selected.push({
    path: node.path,
    field: fd.id,
    fetch: F.id,
    list: node.underList,
    addedByRouter: at.why ?? null,
  });
  const endpoint = fd.via === undefined ? undefined : c.g.get(fd.via);
  const viaSvc = endpoint?.$type === 'endpoint' ? (endpoint.$service ?? null) : null;
  recordVia(F, fd, viaSvc);
  recordReads(c, F, { fd, viaSvc });
  recordCaches(F, fd);
}
