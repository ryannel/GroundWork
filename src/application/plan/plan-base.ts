// A plan stores what it changes; its today is a base it is put onto when read. An open plan reads the workspace's
// live model of today, so a change to today reaches every open plan; a landed plan keeps a frozen copy. The plan
// is checked against the whole base, and drawn with the part of it the plan names and what that part needs.

import type { Issue } from '@/application/plan/check-context';
import { isRecord } from '@/application/plan/ids';
import { SYSTEM_COLLECTIONS } from '@/domain/plan/plan-ids';

export type Collection = keyof typeof SYSTEM_COLLECTIONS;
type Entity = Readonly<Record<string, unknown>>;
export type BaseCollections = Partial<Record<Collection, readonly Entity[]>>;

export interface PlanBase {
  readonly collections: BaseCollections;
  /** Live: the workspace's model of today. Landed: the copy kept when the plan's changes reached today. */
  readonly mode: 'live' | 'landed';
  readonly landedOn: string | null;
}

/** Where a plan's today comes from and whether today has moved under it. */
export interface BaseInfo {
  readonly mode: 'live' | 'landed' | 'none';
  readonly landedOn: string | null;
  /** When the plan's changes were last read against today. */
  readonly checkedOn: string | null;
  /** The things the plan changes that today has changed since it was checked. */
  readonly drift: readonly string[];
}

export const NO_BASE: BaseInfo = { mode: 'none', landedOn: null, checkedOn: null, drift: [] };

const isCollection = (key: string): key is Collection => key in SYSTEM_COLLECTIONS;
const COLLECTIONS: readonly Collection[] = Object.keys(SYSTEM_COLLECTIONS).filter(isCollection);
const MENTION = /\[\[([^\]|#]+)/gu;

const rootOf = (id: string): string => id.split('#', 1)[0] ?? id;

const listOf = (value: unknown): readonly Entity[] =>
  Array.isArray(value) ? value.filter((item): item is Entity => isRecord(item)) : [];

const idOf = (entity: Entity): string | null => (typeof entity.id === 'string' ? entity.id : null);

/** The system collections in plan-shaped data: a landed plan's kept copy, or today's document. */
export function collectionsOf(data: unknown): BaseCollections {
  if (!isRecord(data)) return {};
  return Object.fromEntries(
    COLLECTIONS.filter((key) => Array.isArray(data[key])).map((key) => [key, listOf(data[key])]),
  );
}

/** Every base entity by its id. */
function indexOf(base: PlanBase): Map<string, Entity> {
  const index = new Map<string, Entity>();
  for (const key of COLLECTIONS) {
    for (const entity of base.collections[key] ?? []) {
      const id = idOf(entity);
      if (id !== null) index.set(id, entity);
    }
  }
  return index;
}

function stringsIn(value: unknown, visit: (text: string) => void): void {
  if (typeof value === 'string') visit(value);
  else if (Array.isArray(value)) for (const item of value) stringsIn(item, visit);
  else if (isRecord(value)) for (const item of Object.values(value)) stringsIn(item, visit);
}

/** The base ids a value names, as a reference or a [[mention]]. */
function namedIn(value: unknown, owners: ReadonlyMap<string, string>): Set<string> {
  const found = new Set<string>();
  const note = (id: string): void => {
    const owner = owners.get(rootOf(id.trim()));
    if (owner !== undefined) found.add(owner);
  };
  stringsIn(value, (text) => {
    note(text);
    if (text.includes('[[')) for (const match of text.matchAll(MENTION)) note(match[1] ?? '');
  });
  return found;
}

/**
 * What of the base a plan shows: what its versions name (changes, narrative, `context`) and, to a fixpoint, what
 * those name in turn. Every version of a plan shares one scope, so a diff between them shows only the plan.
 */
export function scopeOf(base: PlanBase, versions: readonly unknown[]): Set<string> {
  const known = indexOf(base);
  const owners = ownersOf(known);
  const roots = rootTypesOf(base);
  const scope = new Set<string>();
  const queue = [...namedIn(versions, owners)];
  while (queue.length > 0) {
    const id = queue.pop() ?? '';
    if (scope.has(id)) continue;
    scope.add(id);
    for (const next of namedIn(known.get(id), owners)) if (!scope.has(next)) queue.push(next);
  }
  // A graph's root types come too, but are not followed: they name every subgraph, and would bring in all of today.
  const rootTypes = [...scope].flatMap((id) => roots.get(id) ?? []);
  for (const root of rootTypes) scope.add(root);
  return scope;
}

/** A root type keeps only the fields whose owners and resolvers are already in scope. */
function trimmed(
  entity: Entity,
  scope: ReadonlySet<string>,
  owners: ReadonlyMap<string, string>,
): Entity {
  if (typeof entity.root !== 'string' || !Array.isArray(entity.fields)) return entity;
  const fields = entity.fields.filter((field) =>
    [...namedIn(field, owners)].every((id) => scope.has(id)),
  );
  return { ...entity, fields };
}

/** Every id in the base, nested ones too (an endpoint, a field), by the entity that holds it. */
function ownersOf(known: ReadonlyMap<string, Entity>): Map<string, string> {
  const owners = new Map<string, string>();
  const walk = (value: unknown, owner: string): void => {
    if (Array.isArray(value)) for (const item of value) walk(item, owner);
    if (!isRecord(value)) return;
    if (typeof value.id === 'string' && !owners.has(value.id)) owners.set(value.id, owner);
    for (const item of Object.values(value)) walk(item, owner);
  };
  for (const [id, entity] of known) {
    owners.set(id, id);
    walk(entity, id);
  }
  return owners;
}

/** A graph is not whole without its root types, which name the graph rather than the other way round. */
function rootTypesOf(base: PlanBase): Map<string, string[]> {
  const roots = new Map<string, string[]>();
  for (const schema of base.collections.schemas ?? []) {
    const id = idOf(schema);
    const { graph, root } = schema;
    if (id === null || typeof graph !== 'string' || typeof root !== 'string') continue;
    roots.set(graph, [...(roots.get(graph) ?? []), id]);
  }
  return roots;
}

function contextIssues(context: unknown, known: ReadonlyMap<string, Entity>): Issue[] {
  const ids: readonly unknown[] = Array.isArray(context) ? context : [];
  return ids.flatMap((id, i) =>
    typeof id === 'string' && known.has(id)
      ? []
      : [{ path: `context[${String(i)}]`, message: `${String(id)} is not in today` }],
  );
}

function listedIssues(
  key: Collection,
  own: readonly Entity[],
  known: ReadonlyMap<string, Entity>,
): Issue[] {
  return own.flatMap((entity, i) => {
    const id = idOf(entity);
    return id !== null && known.has(id)
      ? [
          {
            path: `${key}[${String(i)}]`,
            message: `${id} is already in today; change it with an op instead of listing it`,
          },
        ]
      : [];
  });
}

/**
 * The plan as every view reads it: the base's entities (all of them, or those in scope) first, then any the
 * plan lists itself. A plan that lists a thing today already has is told to change it with an op instead.
 */
export function onBase(
  raw: Readonly<Record<string, unknown>>,
  base: PlanBase,
  scope: ReadonlySet<string> | null,
): { readonly doc: Record<string, unknown>; readonly issues: readonly Issue[] } {
  const known = indexOf(base);
  const issues: Issue[] = [];
  const { context, ...rest } = raw;
  issues.push(...contextIssues(context, known));
  const doc: Record<string, unknown> = { ...rest };
  const owners = ownersOf(known);
  const inScope = (entity: Entity): boolean => {
    const id = idOf(entity);
    return scope === null || (id !== null && scope.has(id));
  };
  for (const key of COLLECTIONS) {
    const own = listOf(raw[key]);
    issues.push(...listedIssues(key, own, known));
    const kept = (base.collections[key] ?? [])
      .filter((entity) => inScope(entity))
      .map((entity) => structuredClone(scope === null ? entity : trimmed(entity, scope, owners)));
    if (kept.length > 0 || own.length > 0) doc[key] = [...kept, ...own];
  }
  return { doc, issues };
}

/** The things in the base a plan's ops lean on: what they modify or remove, and the steps they add after. */
export function anchorsOf(raw: unknown): string[] {
  const anchors = new Set<string>();
  const changes = isRecord(raw) ? listOf(raw.changes) : [];
  const ops = changes.flatMap((change) => listOf(change.ops));
  for (const op of ops) {
    for (const key of ['modify', 'remove', 'after'] as const) {
      const id = op[key];
      if (typeof id === 'string') anchors.add(id);
    }
  }
  return [...anchors].toSorted((a, b) => a.localeCompare(b));
}

function findIn(value: unknown, id: string): Entity | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findIn(item, id);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.id === id) return value;
  return findIn(Object.values(value), id);
}

/** A thing in the base by id: an entity, a nested thing with that id, or `parent#name` for a named part. */
export function nodeOf(base: PlanBase, id: string): Entity | null {
  const parent = indexOf(base).get(rootOf(id)) ?? null;
  if (parent === null || !id.includes('#')) return parent;
  const nested = findIn(parent, id);
  if (nested !== null) return nested;
  return namedPart(Object.values(parent), id.slice(id.indexOf('#') + 1));
}

function namedPart(value: unknown, name: string): Entity | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = namedPart(item, name);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.name === name || value.id === name) return value;
  return namedPart(Object.values(value), name);
}

// Where in the code a fact was found changes with every scan; what it says is what a plan leans on.
function sorted(key: string, item: unknown): unknown {
  if (key === 'sources') return null;
  if (!isRecord(item) || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item).toSorted(([a], [b]) => a.localeCompare(b)));
}

const canonical = (value: unknown): string => JSON.stringify(value, sorted);

/** A short, stable hash of what a thing says (FNV-1a); "absent" when today has no such thing. */
export function fingerprintOf(node: unknown): string {
  if (node === null || node === undefined) return 'absent';
  let hash = 0x81_1c_9d_c5;
  for (const char of canonical(node)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** What each thing a plan's ops lean on says today, to keep beside the plan. */
export function lockOf(raw: unknown, base: PlanBase): Record<string, string> {
  return Object.fromEntries(anchorsOf(raw).map((id) => [id, fingerprintOf(nodeOf(base, id))]));
}

/** The things a plan leans on that today has changed since the lock was written. */
export function driftOf(
  raw: unknown,
  base: PlanBase,
  lock: Readonly<Record<string, string>>,
): string[] {
  return anchorsOf(raw).filter((id) => {
    const kept = lock[id];
    return kept !== undefined && kept !== fingerprintOf(nodeOf(base, id));
  });
}
