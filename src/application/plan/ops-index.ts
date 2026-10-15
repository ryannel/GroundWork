import { fieldId, isRecord, type Rec } from '@/application/plan/ids';
import type { OpRecord, SystemSource } from '@/domain/plan/plan-graph';
import {
  CHILDREN,
  SYSTEM_COLLECTIONS,
  type ContainerType,
  type EntityType,
  type PathSegment,
} from '@/domain/plan/plan-ids';

export type CollectionKey = keyof typeof SYSTEM_COLLECTIONS;

/** One id in a system being edited: the live entity, the list it sits in, and its container. */
export interface Entry {
  entity: Rec;
  type: EntityType;
  list: unknown[];
  parent: string | null;
}

export interface SystemIndex {
  idx: Map<string, Entry>;
  origins: Map<string, PathSegment[]>;
}

function collectionKeys(): CollectionKey[] {
  return Object.keys(SYSTEM_COLLECTIONS).filter((k): k is CollectionKey =>
    Object.hasOwn(SYSTEM_COLLECTIONS, k),
  );
}

export function collectionKeyOf(type: string): CollectionKey | undefined {
  return collectionKeys().find((k) => SYSTEM_COLLECTIONS[k] === type);
}

export function isContainer(type: EntityType): type is ContainerType {
  return Object.hasOwn(CHILDREN, type);
}

/** Id of a child entity (fields are addressed by name). */
function childId(parentId: string, childType: EntityType, child: unknown): string | undefined {
  if (!isRecord(child)) return undefined;
  if (childType === 'field') return fieldId(parentId, child.name);
  return typeof child.id === 'string' ? child.id : undefined;
}

/** An entity that may have children, and where it sits (`base` is the path to the entity). */
interface Parent {
  entity: Rec;
  type: EntityType;
  base: PathSegment[];
}

export function indexChildren(ix: SystemIndex, parent: Parent): void {
  const { entity, type, base } = parent;
  if (!isContainer(type)) return;
  const [prop, ctype] = CHILDREN[type];
  const kids = entity[prop];
  const pid = entity.id;
  if (!Array.isArray(kids) || typeof pid !== 'string') return;
  const list: unknown[] = kids;
  for (const [j, c] of list.entries()) {
    const cid = childId(pid, ctype, c);
    if (cid === undefined || !isRecord(c)) continue;
    if (!ix.idx.has(cid)) ix.idx.set(cid, { entity: c, type: ctype, list, parent: pid });
    if (!ix.origins.has(cid) || base[0] === 'changes') ix.origins.set(cid, [...base, prop, j]);
  }
}

/** Index a (cloned) system by id, so ops can find what they target. */
export function indexSystem(system: SystemSource): SystemIndex {
  const ix: SystemIndex = { idx: new Map(), origins: new Map() };
  for (const key of collectionKeys()) {
    const list: unknown[] = system[key];
    const type = SYSTEM_COLLECTIONS[key];
    for (const [i, entity] of list.entries()) {
      if (!isRecord(entity) || typeof entity.id !== 'string') continue;
      if (!ix.idx.has(entity.id)) ix.idx.set(entity.id, { entity, type, list, parent: null });
      ix.origins.set(entity.id, [key, i]);
      indexChildren(ix, { entity, type, base: [key, i] });
    }
  }
  return ix;
}

/** Ids of an entity and all of its children. */
export function selfAndChildren(entity: Rec, type: EntityType): string[] {
  const ids = typeof entity.id === 'string' ? [entity.id] : [];
  if (!isContainer(type) || typeof entity.id !== 'string') return ids;
  const [prop, ctype] = CHILDREN[type];
  const kids = entity[prop];
  if (!Array.isArray(kids)) return ids;
  const list: unknown[] = kids;
  for (const c of list) {
    const cid = childId(entity.id, ctype, c);
    if (cid !== undefined) ids.push(cid);
  }
  return ids;
}

/** Record a problem (or warning) on an op record; `at` is relative to the op. */
export function flag(
  rec: OpRecord,
  note: { code: string; at: PathSegment[]; message: string; warning?: boolean },
): void {
  const { warning, ...problem } = note;
  (warning === true ? rec.warnings : rec.problems).push(problem);
}

/** Fill in fields of an op record as the op is applied. */
export function patch(rec: OpRecord, fields: Partial<OpRecord>): void {
  Object.assign(rec, fields);
}

/** Set a prop on a live entity. */
export function setProp(entity: Rec, prop: string, value: unknown): void {
  Reflect.set(entity, prop, value);
}
