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
  createPlanCtx,
  newFetch,
  ownersOf,
  resolveIn,
  teamOf,
  type PlanCtx,
  type Placed,
} from '@/application/plan/federation-place';
import type { Fetch, PlanWarning, QueryPlan } from '@/application/plan/federation-plan-types';
import {
  selectionTree,
  type SelectionTree,
  type TreeNode,
} from '@/application/plan/federation-tree';
import { walk } from '@/application/plan/federation-walk';
import type { FieldNode, OperationNode, SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

const plans = memoPerGraph<QueryPlan>();

interface RootPlaced {
  /** The root fetch the field went into. */
  readonly root: Fetch;
  /** The ids of the fetches it placed. */
  readonly placed: readonly string[];
}

/** Places a root field; null when the field has no owner. */
function placeRoot(
  c: PlanCtx,
  rootBySg: ReadonlyMap<string, Fetch>,
  at: {
    readonly node: TreeNode;
    readonly fd: FieldNode;
    readonly root: SchemaNode;
    readonly previous: readonly string[];
  },
): RootPlaced | null {
  const { node, fd, root } = at;
  const sg = ownersOf(c, fd)[0];
  if (sg === undefined) {
    c.warn({
      code: 'no-owner',
      message: `${fieldLabel(c.g, fd.id)} has no subgraph that resolves it; add subgraphs: [sg:…]`,
      path: node.path,
    });
    return null;
  }
  const before = c.fetches().length;
  const shared = c.kind === 'mutation' ? undefined : rootBySg.get(sg);
  const F =
    shared ?? newFetch(c, { kind: 'root', subgraph: sg, type: root.id, after: at.previous });
  resolveIn(c, F, { node, fd });
  const T = schemaNode(c.g, node.type);
  if (node.children.length > 0 && T !== undefined) {
    walk(c, { P: node, T, F, provided: new Set(fd.provides) });
  }
  return {
    root: F,
    placed: c
      .fetches()
      .slice(before)
      .map((f) => f.id),
  };
}

/** Root fetches: queries share one fetch per subgraph; mutation fields run one after another. */
function placeRoots(c: PlanCtx, tree: SelectionTree, root: SchemaNode): void {
  const mutation = c.kind === 'mutation';
  const rootBySg = new Map<string, Fetch>();
  let previous: readonly string[] = [];
  for (const node of tree.nodes) {
    const fd = fieldNode(c.g, node.field);
    const placed = fd === undefined ? null : placeRoot(c, rootBySg, { node, fd, root, previous });
    if (placed !== null && !mutation) rootBySg.set(placed.root.subgraph, placed.root);
    if (placed !== null && mutation) previous = placed.placed;
  }
}

/** Below a list the subgraph resolves n representations, batched or one by one. */
function withCardinality(g: SystemGraph, f: Fetch): Fetch {
  if (f.kind !== 'entity' || !f.list) return f;
  const explicit = f.fields
    .map((id) => fieldNode(g, id)?.batched)
    .filter((b): b is boolean => typeof b === 'boolean');
  const batched =
    explicit.length > 0
      ? explicit.some(Boolean)
      : subgraphNode(g, f.subgraph)?.batching === 'dataloader';
  return { ...f, batched, nPlusOne: !batched, representations: 'n' };
}

/** Each fetch's round trip, in fetch order: one after the deepest fetch it waits for. */
function withDepths(fetches: readonly Fetch[]): readonly Fetch[] {
  const depth = new Map<string, number>();
  return fetches.map((f) => {
    const d = 1 + Math.max(0, ...f.after.map((a) => depth.get(a) ?? 0));
    depth.set(f.id, d);
    return { ...f, depth: d };
  });
}

type Shape = Pick<
  QueryPlan,
  'levels' | 'roundTrips' | 'parallelism' | 'services' | 'teams' | 'stores'
>;

function shapeOf(g: SystemGraph, fetches: readonly Fetch[]): Shape {
  const roundTrips = Math.max(0, ...fetches.map((f) => f.depth));
  const levels = Array.from({ length: roundTrips }, (_, i) =>
    fetches.filter((f) => f.depth === i + 1).map((f) => f.id),
  );
  const services = uniq([
    ...fetches.map((f) => f.service),
    ...fetches.flatMap((f) => f.vias.map((v) => v.to)),
  ]);
  return {
    levels,
    roundTrips,
    parallelism: Math.max(0, ...levels.map((l) => l.length)),
    services,
    teams: uniq(services.map((s) => teamOf(g, s))),
    stores: uniq(
      fetches.flatMap((f) => [...f.reads.map((r) => r.store), ...f.caches.map((x) => x.at)]),
    ),
  };
}

function authOf(g: SystemGraph, selected: Placed['selected']): QueryPlan['auth'] {
  const out: { readonly field: string; readonly auth: string }[] = [];
  for (const s of selected) {
    const auth = fieldNode(g, s.field)?.auth;
    const counts = s.addedByRouter === null && auth !== undefined && auth.trim() !== '';
    if (counts && !out.some((x) => x.field === s.field)) out.push({ field: s.field, auth });
  }
  return out;
}

/** Check the derived plan against the registry's `plan_check`. */
function registryWarning(
  op: OperationNode,
  plan: Pick<QueryPlan, 'fetches' | 'roundTrips'>,
): PlanWarning | null {
  const pc = op.plan_check;
  if (pc === undefined) return null;
  const { fetches, roundTrips } = plan;
  const bits = [
    pc.fetches !== undefined && pc.fetches !== fetches.length
      ? `${String(fetches.length)} fetches, registry says ${String(pc.fetches)}`
      : null,
    pc.round_trips !== undefined && pc.round_trips !== roundTrips
      ? `${String(roundTrips)} round trips, registry says ${String(pc.round_trips)}`
      : null,
  ].filter((b): b is string => b !== null);
  if (bits.length === 0) return null;
  return {
    code: 'plan-check',
    message: `${op.name}: derived ${bits.join('; ')}; a @requires, @provides or key is probably missing from the model`,
  };
}

/** The plan once every field is placed: cardinality, depth and width, auth, and the registry check. */
function finish(c: PlanCtx, op: OperationNode, empty: QueryPlan): QueryPlan {
  const { g } = c;
  const fetches = withDepths(c.fetches().map((f) => withCardinality(g, f)));
  const shape = shapeOf(g, fetches);
  const check = registryWarning(op, { fetches, roundTrips: shape.roundTrips });
  if (check !== null) c.warn(check);
  const placed = c.placed();
  return { ...empty, ...placed, ...shape, fetches, auth: authOf(g, placed.selected) };
}

function planOf(g: SystemGraph, opId: string): QueryPlan {
  const tree = selectionTree(g, opId);
  const op = tree.operation;
  const idx = graphIndex(g, op?.graph);
  const empty: QueryPlan = {
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
  if (op === null) return empty;
  if (empty.kind === 'subscription') {
    const message = `${op.name} is a subscription; no query plan is derived for subscriptions`;
    return { ...empty, warnings: [...empty.warnings, { code: 'subscription', message }] };
  }
  if (tree.root === null) return empty;
  const c = createPlanCtx({ g, idx, kind: empty.kind }, empty.warnings);
  placeRoots(c, tree, tree.root);
  return finish(c, op, empty);
}

/**
 * The query plan the gateway derives for an operation: root fetch per owning subgraph, entity fetches by key,
 * @requires and @provides, depth and width, batching, auth, and a check against the registry's `plan_check`.
 * Never throws; a document it cannot resolve comes back as warnings with no fetches.
 */
export function queryPlan(g: SystemGraph, opId: string): QueryPlan {
  return plans(g, opId, () => planOf(g, opId));
}
