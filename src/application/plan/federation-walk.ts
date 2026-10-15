import { uniq } from '@/application/plan/derive-values';
import {
  fieldLabel,
  fieldNamed,
  fieldNode,
  isKeyField,
  keyIns,
  keysOf,
  schemaNode,
  sgName,
  sharedKey,
} from '@/application/plan/federation-index';
import { parseTypeRef } from '@/application/plan/federation-parse';
import {
  newFetch,
  ownersOf,
  resolveIn,
  warn,
  type PlanCtx,
} from '@/application/plan/federation-place';
import type { Added, Fetch } from '@/application/plan/federation-plan-types';
import type { TreeNode } from '@/application/plan/federation-tree';
import { parentOf } from '@/application/plan/ids';
import type { FieldNode, SchemaNode } from '@/domain/plan/plan-graph';

/** Where a child is being placed: under node P (of type T), whose fetch is F. */
interface Spot {
  P: TreeNode;
  T: SchemaNode;
  F: Fetch;
  /** Fields of the type the providing field returns, resolvable in F's subgraph. */
  provided: ReadonlySet<string>;
}

interface EntitySpec {
  path: string;
  sg: string;
  type: SchemaNode;
  after: string[];
  intermediate?: boolean;
  list: boolean;
}

function entityFetch(c: PlanCtx, spec: EntitySpec): Fetch {
  const after = uniq(spec.after).toSorted((x, y) => x.localeCompare(y));
  const key = `${spec.path}|${spec.sg}|${after.join(',')}`;
  const hit = c.entityAt.get(key);
  if (hit !== undefined) return hit;
  const f = newFetch(c, {
    kind: 'entity',
    subgraph: spec.sg,
    type: spec.type.id,
    path: spec.path,
    after,
    intermediate: spec.intermediate ?? false,
    list: spec.list,
  });
  c.entityAt.set(key, f);
  return f;
}

function addKey(
  c: PlanCtx,
  F: Fetch,
  at: { type: SchemaNode; key: ReturnType<typeof sharedKey>; parentPath: string },
): void {
  for (const name of at.key?.fields ?? []) {
    const fd = fieldNamed(at.type, name);
    if (fd === null || F.fields.includes(fd.id)) continue;
    F.fields.push(fd.id);
    F.keyFields.push(fd.id);
    const path = at.parentPath === '' ? name : `${at.parentPath}.${name}`;
    const added: Added = { path, field: fd.id, fetch: F.id, reason: 'key' };
    c.out.addedByRouter.push(added);
  }
}

/** The fetch an entity fetch in subgraph `Pk` hangs after: F itself on a shared key, else an intermediate hop. */
function keyHop(
  c: PlanCtx,
  spot: Spot,
  target: { node: TreeNode; fd: FieldNode; sg: string },
): Fetch | null {
  const { P, T, F } = spot;
  const S = F.subgraph;
  const Pk = target.sg;
  const direct = sharedKey(T, [S, Pk]);
  if (direct !== null) {
    addKey(c, F, { type: T, key: direct, parentPath: P.path });
    return F;
  }
  const M = c.idx.subgraphs
    .map((s) => s.id)
    .find(
      (m) => m !== S && m !== Pk && sharedKey(T, [S, m]) !== null && sharedKey(T, [m, Pk]) !== null,
    );
  if (M === undefined) {
    warn(c, {
      code: 'no-shared-key',
      message: `${T.name} cannot be reached from ${sgName(c.g, S)} by ${sgName(c.g, Pk)}: no shared key (${fieldLabel(c.g, target.fd.id)} at ${target.node.path})`,
      path: target.node.path,
    });
    return null;
  }
  addKey(c, F, { type: T, key: sharedKey(T, [S, M]), parentPath: P.path });
  const hop = entityFetch(c, {
    path: P.path,
    sg: M,
    type: T,
    after: [F.id],
    intermediate: true,
    list: P.underList,
  });
  addKey(c, hop, { type: T, key: sharedKey(T, [M, Pk]), parentPath: P.path });
  return hop;
}

function nextProvided(c: PlanCtx, node: TreeNode, at: { spot: Spot; fd: FieldNode }): Set<string> {
  const { spot, fd } = at;
  const own = fd.provides ?? [];
  const entity = keysOf(schemaNode(c.g, node.type)).length > 0;
  return entity ? new Set(own) : new Set([...spot.provided, ...own]);
}

function descend(
  c: PlanCtx,
  node: TreeNode,
  at: { into: Fetch; spot: Spot; fd: FieldNode },
): Fetch {
  const T = schemaNode(c.g, node.type);
  if (node.children.length > 0 && T !== undefined) {
    walk(c, { P: node, T, F: at.into, provided: nextProvided(c, node, at) });
  }
  return at.into;
}

/** Place one child node under the spot's parent, resolved by the spot's fetch. Returns the fetch it lands in. */
function place(c: PlanCtx, node: TreeNode, spot: Spot): Fetch | null {
  const fd = fieldNode(c.g, node.field);
  if (fd === undefined) return null;
  const placed = c.placement.get(node);
  if (placed !== undefined) return placed;
  if (c.busy.has(node)) return null; // a @requires cycle: the validator reports it
  c.busy.add(node);
  try {
    return placeOnce(c, node, { spot, fd });
  } finally {
    c.busy.delete(node);
  }
}

function placeOnce(c: PlanCtx, node: TreeNode, at: { spot: Spot; fd: FieldNode }): Fetch | null {
  const { spot, fd } = at;
  const { P, T, F, provided } = spot;
  const why = node.$router ?? undefined;
  const resolved = (into: Fetch): Fetch => {
    resolveIn(c, into, why === undefined ? { node, fd } : { node, fd, why });
    return descend(c, node, { into, spot, fd });
  };
  // value types (no keys) are resolved inside the parent fetch
  if (keysOf(T).length === 0) return resolved(F);
  const S = F.subgraph;
  const cand = uniq([
    ...ownersOf(c, fd),
    ...(isKeyField(T, fd.name) ? keyIns(T, fd.name) : []),
    ...(provided.has(fd.id) ? [S] : []),
  ]);
  if (cand.includes(S)) return resolved(F);
  if (cand.length === 0) {
    warn(c, {
      code: 'no-owner',
      message: `${fieldLabel(c.g, fd.id)} has no subgraph that resolves it; add subgraphs: [sg:…]`,
      path: node.path,
    });
    return null;
  }
  // @requires: schedule the required fields first; their fetches come before this one
  const producers = (fd.requires ?? []).flatMap((rid) => {
    const made = placeRequired(c, rid, { spot, by: fd });
    return made === null ? [] : [made.id];
  });
  const Pk =
    cand.find((x) =>
      c.out.fetches.some((f) => f.path === P.path && f.subgraph === x && f.kind === 'entity'),
    ) ?? cand[0];
  if (Pk === undefined) return null;
  const from = keyHop(c, spot, { node, fd, sg: Pk });
  if (from === null) return null;
  const E = entityFetch(c, {
    path: P.path,
    sg: Pk,
    type: T,
    after: [from.id, ...producers],
    list: P.underList,
  });
  return resolved(E);
}

function synth(c: PlanCtx, fd: FieldNode, parent: TreeNode): TreeNode {
  const ref = parseTypeRef(fd.type);
  const node: TreeNode = {
    path: `${parent.path}.${fd.name}`,
    key: fd.name,
    name: fd.name,
    alias: null,
    field: fd.id,
    parentType: parentOf(fd.id),
    type: c.idx.types.get(ref.name)?.id ?? null,
    typeStr: fd.type,
    list: ref.list,
    underList: ref.list || parent.underList,
    nonNull: ref.nonNull,
    parent,
    children: [],
    $router: 'requires',
  };
  c.out.routerNodes.push(node);
  return node;
}

function noteRequired(c: PlanCtx, made: Fetch, rec: { node: TreeNode; rid: string }): void {
  made.requiredFields.push(rec.rid);
  c.out.addedByRouter.push({
    path: rec.node.path,
    field: rec.rid,
    fetch: made.id,
    reason: 'requires',
  });
}

/** The required field is on the spot's own type. */
function placeSibling(c: PlanCtx, rf: FieldNode, spot: Spot): Fetch | null {
  const have = spot.P.children.find((k) => k.field === rf.id);
  if (have !== undefined) return c.placement.get(have) ?? place(c, have, spot);
  const node = synth(c, rf, spot.P);
  const made = place(c, node, spot);
  if (made !== null) noteRequired(c, made, { node, rid: rf.id });
  return made;
}

/** The field of T through which the required field's type is reached, as a node under P (placed on demand). */
function viaNode(c: PlanCtx, spot: Spot, via: FieldNode): { mid: TreeNode; at: Fetch | null } {
  const found = spot.P.children.find((k) => k.field === via.id);
  if (found !== undefined)
    return { mid: found, at: c.placement.get(found) ?? place(c, found, spot) };
  const mid = synth(c, via, spot.P);
  const at = place(c, mid, spot);
  if (at !== null) {
    c.out.addedByRouter.push({ path: mid.path, field: via.id, fetch: at.id, reason: 'requires' });
  }
  return { mid, at };
}

/** One level down: a field of T that returns the required field's type (stock { fc }). */
function placeNested(c: PlanCtx, rf: FieldNode, at: { spot: Spot; by: FieldNode }): Fetch | null {
  const { spot, by } = at;
  const target = schemaNode(c.g, parentOf(rf.id));
  const via = spot.T.fields.find(
    (f) => f.id !== by.id && c.idx.types.get(parseTypeRef(f.type).name) === target,
  );
  if (via === undefined || target === undefined) return null;
  const { mid, at: midAt } = viaNode(c, spot, via);
  if (midAt === null) return null;
  const have = mid.children.find((k) => k.field === rf.id);
  if (have !== undefined) return c.placement.get(have) ?? null;
  const leaf = synth(c, rf, mid);
  const made = place(c, leaf, { P: mid, T: target, F: midAt, provided: new Set() });
  if (made !== null) noteRequired(c, made, { node: leaf, rid: rf.id });
  return made;
}

/** A required field as if selected (marked 'requires'); returns the fetch that produces it. */
function placeRequired(c: PlanCtx, rid: string, at: { spot: Spot; by: FieldNode }): Fetch | null {
  const rf = fieldNode(c.g, rid);
  if (rf === undefined || rid === at.by.id) return null;
  return parentOf(rid) === at.spot.T.id ? placeSibling(c, rf, at.spot) : placeNested(c, rf, at);
}

/** Place every child of the spot's parent that its fetch resolves; @requires fields after the rest. */
export function walk(c: PlanCtx, spot: Spot): void {
  const kids = spot.P.children.filter((k) => k.field !== null);
  const requires = (k: TreeNode): boolean => (fieldNode(c.g, k.field)?.requires ?? []).length > 0;
  for (const k of kids.filter((x) => !requires(x))) place(c, k, spot);
  for (const k of kids.filter(requires)) place(c, k, spot);
}
