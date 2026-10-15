import { uniq } from '@/application/plan/derive-values';
import {
  fieldLabel,
  fieldNode,
  graphIndex,
  memoPerGraph,
  schemaNode,
  subgraphNode,
} from '@/application/plan/federation-index';
import {
  newFetch,
  ownersOf,
  resolveIn,
  teamOf,
  warn,
  type PlanCtx,
} from '@/application/plan/federation-place';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import {
  selectionTree,
  type SelectionTree,
  type TreeNode,
} from '@/application/plan/federation-tree';
import { walk } from '@/application/plan/federation-walk';
import type { FieldNode, OperationNode, SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

const plans = memoPerGraph<QueryPlan>();

interface RootState {
  mutation: boolean;
  rootBySg: Map<string, Fetch>;
  previous: string[];
}

/** Returns the ids of the fetches it placed, or null when the field has no owner. */
function placeRoot(
  c: PlanCtx,
  st: RootState,
  at: { node: TreeNode; fd: FieldNode; root: SchemaNode },
): string[] | null {
  const { node, fd, root } = at;
  const sg = ownersOf(c, fd)[0];
  if (sg === undefined) {
    warn(c, {
      code: 'no-owner',
      message: `${fieldLabel(c.g, fd.id)} has no subgraph that resolves it; add subgraphs: [sg:…]`,
      path: node.path,
    });
    return null;
  }
  const before = c.out.fetches.length;
  const shared = st.mutation ? undefined : st.rootBySg.get(sg);
  const F =
    shared ?? newFetch(c, { kind: 'root', subgraph: sg, type: root.id, after: st.previous });
  if (!st.mutation) st.rootBySg.set(sg, F);
  resolveIn(c, F, { node, fd });
  const T = schemaNode(c.g, node.type);
  if (node.children.length > 0 && T !== undefined) {
    walk(c, { P: node, T, F, provided: new Set(fd.provides) });
  }
  return c.out.fetches.slice(before).map((f) => f.id);
}

/** Root fetches: queries share one fetch per subgraph; mutation fields run one after another. */
function placeRoots(c: PlanCtx, tree: SelectionTree, root: SchemaNode): void {
  const st: RootState = { mutation: c.out.kind === 'mutation', rootBySg: new Map(), previous: [] };
  for (const node of tree.nodes) {
    const fd = fieldNode(c.g, node.field);
    if (fd === undefined) continue;
    const placed = placeRoot(c, st, { node, fd, root });
    if (st.mutation && placed !== null) st.previous = placed;
  }
}

/** Below a list the subgraph resolves n representations, batched or one by one. */
function cardinality(c: PlanCtx): void {
  for (const f of c.out.fetches) {
    if (f.kind !== 'entity' || !f.list) continue;
    const explicit = f.fields
      .map((id) => fieldNode(c.g, id)?.batched)
      .filter((b): b is boolean => typeof b === 'boolean');
    f.batched =
      explicit.length > 0
        ? explicit.some(Boolean)
        : subgraphNode(c.g, f.subgraph)?.batching === 'dataloader';
    f.nPlusOne = !f.batched;
    f.representations = 'n';
  }
}

function depthAndWidth(c: PlanCtx): void {
  const { out } = c;
  const byId = new Map(out.fetches.map((f) => [f.id, f]));
  for (const f of out.fetches) {
    f.depth = 1 + Math.max(0, ...f.after.map((a) => byId.get(a)?.depth ?? 0));
  }
  out.roundTrips = Math.max(0, ...out.fetches.map((f) => f.depth));
  for (let d = 1; d <= out.roundTrips; d += 1) {
    out.levels.push(out.fetches.filter((f) => f.depth === d).map((f) => f.id));
  }
  out.parallelism = Math.max(0, ...out.levels.map((l) => l.length));
  out.services = uniq([
    ...out.fetches.map((f) => f.service),
    ...out.fetches.flatMap((f) => f.vias.map((v) => v.to)),
  ]);
  out.teams = uniq(out.services.map((s) => teamOf(c.g, s)));
  out.stores = uniq(
    out.fetches.flatMap((f) => [...f.reads.map((r) => r.store), ...f.caches.map((x) => x.at)]),
  );
  out.overrides = [...c.overrides.values()];
}

function foldAuth(c: PlanCtx): void {
  for (const s of c.out.selected) {
    const auth = fieldNode(c.g, s.field)?.auth;
    if (s.addedByRouter !== null || auth === undefined || auth.trim() === '') continue;
    if (!c.out.auth.some((x) => x.field === s.field)) c.out.auth.push({ field: s.field, auth });
  }
}

/** Check the derived plan against the registry's `plan_check`. */
function checkRegistry(c: PlanCtx, op: OperationNode): void {
  const pc = op.plan_check;
  if (pc === undefined) return;
  const { fetches, roundTrips } = c.out;
  const bits: string[] = [];
  if (pc.fetches !== undefined && pc.fetches !== fetches.length) {
    bits.push(`${String(fetches.length)} fetches, registry says ${String(pc.fetches)}`);
  }
  if (pc.round_trips !== undefined && pc.round_trips !== roundTrips) {
    bits.push(`${String(roundTrips)} round trips, registry says ${String(pc.round_trips)}`);
  }
  if (bits.length > 0) {
    warn(c, {
      code: 'plan-check',
      message: `${op.name}: derived ${bits.join('; ')}; a @requires, @provides or key is probably missing from the model`,
    });
  }
}

function planOf(g: SystemGraph, opId: string): QueryPlan {
  const tree = selectionTree(g, opId);
  const op = tree.operation;
  const idx = graphIndex(g, op?.graph);
  const out: QueryPlan = {
    operation: opId,
    name: op?.name ?? null,
    kind: tree.parsed.kind ?? op?.kind ?? null,
    graph: op?.graph ?? null,
    gateway: idx.gateway,
    gatewayTeam: teamOf(g, idx.gateway),
    fetches: [],
    levels: [],
    roundTrips: 0,
    parallelism: 0,
    services: [],
    teams: [],
    stores: [],
    selected: [],
    addedByRouter: [],
    routerNodes: [],
    auth: [],
    overrides: [],
    variables: tree.parsed.variables,
    warnings: tree.errors.map((e) => ({ ...e })),
  };
  if (op === null) return out;
  if (out.kind === 'subscription') {
    out.warnings.push({
      code: 'subscription',
      message: `${op.name} is a subscription; no query plan is derived for subscriptions`,
    });
    return out;
  }
  if (tree.root === null) return out;
  const c: PlanCtx = {
    g,
    out,
    idx,
    overrides: new Map(),
    placement: new Map(),
    warned: new Set(),
    entityAt: new Map(),
    busy: new Set(),
  };
  placeRoots(c, tree, tree.root);
  cardinality(c);
  depthAndWidth(c);
  foldAuth(c);
  checkRegistry(c, op);
  return out;
}

/**
 * The query plan the gateway derives for an operation: root fetch per owning subgraph, entity fetches by key,
 * @requires and @provides, depth and width, batching, auth, and a check against the registry's `plan_check`.
 * Never throws; a document it cannot resolve comes back as warnings with no fetches.
 */
export function queryPlan(g: SystemGraph, opId: string): QueryPlan {
  return plans(g, opId, () => planOf(g, opId));
}
