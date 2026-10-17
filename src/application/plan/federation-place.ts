import { uniq } from '@/application/plan/derive-values';
import { schemaNode, subgraphNode, type GraphIndex } from '@/application/plan/federation-index';
import type {
  Added,
  Fetch,
  OverrideInfo,
  PlanWarning,
  QueryPlan,
  Selected,
} from '@/application/plan/federation-plan-types';
import type { TreeNode } from '@/application/plan/federation-tree';
import { parentOf } from '@/application/plan/ids';
import type { FieldNode, SystemGraph } from '@/domain/plan/plan-graph';

/** What one query-plan derivation has placed so far. */
export type Placed = Pick<
  QueryPlan,
  'fetches' | 'selected' | 'addedByRouter' | 'routerNodes' | 'overrides' | 'warnings'
>;

/** What one query-plan derivation shares while it places fields into fetches; it owns the plan being built. */
export interface PlanCtx {
  readonly g: SystemGraph;
  readonly idx: GraphIndex;
  readonly kind: QueryPlan['kind'];
  readonly fetches: () => readonly Fetch[];
  /** The fetch as it stands now: fields placed after `f` was handed out are on it. */
  readonly current: (f: Fetch) => Fetch;
  readonly addFetch: (f: Fetch) => void;
  readonly updateFetch: (id: string, change: (f: Fetch) => Fetch) => void;
  /** Adds a warning once per message. */
  readonly warn: (w: PlanWarning) => void;
  readonly override: (info: OverrideInfo) => void;
  readonly placedIn: (node: TreeNode) => Fetch | undefined;
  readonly placeIn: (node: TreeNode, f: Fetch) => void;
  readonly entityAt: (key: string) => Fetch | undefined;
  readonly setEntityAt: (key: string, f: Fetch) => void;
  /** Marks the node as being placed; false when it already is (a cycle). */
  readonly enter: (node: TreeNode) => boolean;
  readonly leave: (node: TreeNode) => void;
  readonly select: (s: Selected) => void;
  readonly addByRouter: (a: Added) => void;
  readonly addRouterNode: (node: TreeNode) => void;
  readonly placed: () => Placed;
}

type FetchBook = Pick<PlanCtx, 'fetches' | 'current' | 'addFetch' | 'updateFetch'> & {
  readonly byIdOf: (id: string | undefined) => Fetch | undefined;
};

/** The fetches of a plan as they are added and filled in. */
function fetchBook(): FetchBook {
  const fetches: Fetch[] = [];
  const byId = (id: string): Fetch | undefined => fetches.find((f) => f.id === id);
  return {
    byIdOf: (id) => (id === undefined ? undefined : byId(id)),
    fetches: () => fetches,
    current: (f) => byId(f.id) ?? f,
    addFetch: (f) => {
      fetches.push(f);
    },
    updateFetch: (id, change) => {
      const i = fetches.findIndex((f) => f.id === id);
      const f = fetches[i];
      if (f !== undefined) fetches[i] = change(f);
    },
  };
}

export function createPlanCtx(
  at: { readonly g: SystemGraph; readonly idx: GraphIndex; readonly kind: QueryPlan['kind'] },
  warnings: readonly PlanWarning[],
): PlanCtx {
  const { byIdOf, ...book } = fetchBook();
  const shown: PlanWarning[] = [...warnings];
  const warned = new Set<string>();
  const overrides = new Map<string, OverrideInfo>();
  const placement = new Map<TreeNode, string>();
  const entities = new Map<string, string>();
  const busy = new Set<TreeNode>();
  const selected: Selected[] = [];
  const added: Added[] = [];
  const routerNodes: TreeNode[] = [];
  return {
    ...at,
    ...book,
    warn: (w) => {
      if (warned.has(w.message)) return;
      warned.add(w.message);
      shown.push(w.path === undefined ? { code: w.code, message: w.message } : w);
    },
    override: (info) => {
      overrides.set(info.field, info);
    },
    placedIn: (node) => byIdOf(placement.get(node)),
    placeIn: (node, f) => {
      placement.set(node, f.id);
    },
    entityAt: (key) => byIdOf(entities.get(key)),
    setEntityAt: (key, f) => {
      entities.set(key, f.id);
    },
    enter: (node) => {
      if (busy.has(node)) return false;
      busy.add(node);
      return true;
    },
    leave: (node) => {
      busy.delete(node);
    },
    select: (s) => {
      selected.push(s);
    },
    addByRouter: (a) => {
      added.push(a);
    },
    addRouterNode: (node) => {
      routerNodes.push(node);
    },
    placed: () => ({
      fetches: book.fetches(),
      selected,
      addedByRouter: added,
      routerNodes,
      overrides: [...overrides.values()],
      warnings: shown,
    }),
  };
}

/** The subgraphs that own a field, honouring a progressive @override (the majority side first). */
export function ownersOf(c: PlanCtx, fd: FieldNode): readonly string[] {
  const list = uniq(fd.subgraphs ?? []);
  const ov = fd.override;
  if (ov === null || ov === undefined || !list.includes(ov.from)) return list;
  const to = list.filter((x) => x !== ov.from);
  const percent = ov.percent ?? 100;
  c.override({ field: fd.id, from: ov.from, to: to[0] ?? null, percent });
  if (list.length < 2) return list;
  if (percent >= 100) return to;
  return percent >= 50 ? [...to, ov.from] : [ov.from, ...to];
}

interface FetchProps {
  readonly kind: 'root' | 'entity';
  readonly subgraph: string;
  readonly type: string;
  readonly after: readonly string[];
  readonly path?: string;
  readonly intermediate?: boolean;
  readonly list?: boolean;
}

export function teamOf(g: SystemGraph, svc: string | null): string | null {
  const n = g.get(svc);
  return n?.$type === 'service' ? n.team : null;
}

export function newFetch(c: PlanCtx, props: FetchProps): Fetch {
  const service = subgraphNode(c.g, props.subgraph)?.service ?? null;
  const f: Fetch = {
    id: `f${String(c.fetches().length + 1)}`,
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
  c.addFetch(f);
  return f;
}

const withItem = <T>(xs: readonly T[], x: T, has: (y: T) => boolean): readonly T[] =>
  xs.some(has) ? xs : [...xs, x];

function withVia(F: Fetch, fd: FieldNode, viaSvc: string | null): Fetch {
  if (fd.via === undefined) return F;
  const via = { field: fd.id, via: fd.via, to: viaSvc };
  return { ...F, vias: withItem(F.vias, via, (v) => v.field === fd.id) };
}

function withReads(
  c: PlanCtx,
  F: Fetch,
  at: { readonly fd: FieldNode; readonly viaSvc: string | null },
): Fetch {
  const { fd, viaSvc } = at;
  const reads = (fd.reads ?? []).reduce((acc, ref) => {
    const sch = schemaNode(c.g, parentOf(ref) ?? ref);
    const read = { field: fd.id, ref, store: sch?.store ?? null, svc: viaSvc ?? F.service };
    return withItem(acc, read, (r) => r.field === fd.id && r.ref === ref);
  }, F.reads);
  return { ...F, reads };
}

function withCaches(F: Fetch, fd: FieldNode): Fetch {
  const caches = (fd.cache ?? []).reduce(
    (acc, use) =>
      withItem(
        acc,
        { field: fd.id, at: use.at, ttl: use.ttl ?? null },
        (x) => x.field === fd.id && x.at === use.at,
      ),
    F.caches,
  );
  return { ...F, caches };
}

/** Record that fetch F resolves node's field, with the reads, vias and caches behind it. */
export function resolveIn(
  c: PlanCtx,
  F: Fetch,
  at: { readonly node: TreeNode; readonly fd: FieldNode; readonly why?: 'key' | 'requires' },
): void {
  const { node, fd } = at;
  const endpoint = fd.via === undefined ? undefined : c.g.get(fd.via);
  const viaSvc = endpoint?.$type === 'endpoint' ? (endpoint.$service ?? null) : null;
  c.updateFetch(F.id, (f) => {
    const placed = {
      ...f,
      fields: withItem(f.fields, fd.id, (x) => x === fd.id),
      paths: withItem(f.paths, node.path, (x) => x === node.path),
    };
    return withCaches(withReads(c, withVia(placed, fd, viaSvc), { fd, viaSvc }), fd);
  });
  c.placeIn(node, F);
  c.select({
    path: node.path,
    field: fd.id,
    fetch: F.id,
    list: node.underList,
    addedByRouter: at.why ?? null,
  });
}
