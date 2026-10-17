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

/**
 * One id in a system being edited: the live entity, where its list sits (`holder[prop]`), and its
 * container.
 */
export interface Entry {
  readonly entity: Rec;
  readonly type: EntityType;
  readonly holder: Rec;
  readonly prop: string;
  readonly parent: string | null;
}

/** The ids of a system being edited, and where each came from; changed only through its own calls. */
export interface SystemIndex {
  readonly idx: ReadonlyMap<string, Entry>;
  readonly origins: ReadonlyMap<string, readonly PathSegment[]>;
  readonly put: (id: string, entry: Entry) => void;
  readonly drop: (id: string) => void;
  readonly origin: (id: string, path: readonly PathSegment[]) => void;
}

/** The live list at `holder[prop]` in the working copy, or null when there is none. */
export function listOf(holder: Rec, prop: string): unknown[] | null {
  const list: unknown = holder[prop];
  return Array.isArray(list) ? list : null;
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
  readonly entity: Rec;
  readonly type: EntityType;
  readonly base: readonly PathSegment[];
}

export function indexChildren(ix: SystemIndex, parent: Parent): void {
  const { entity, type, base } = parent;
  if (!isContainer(type)) return;
  const [prop, ctype] = CHILDREN[type];
  const list = listOf(entity, prop);
  const pid = entity.id;
  if (list === null || typeof pid !== 'string') return;
  for (const [j, c] of list.entries()) {
    const cid = childId(pid, ctype, c);
    if (cid === undefined || !isRecord(c)) continue;
    if (!ix.idx.has(cid)) {
      ix.put(cid, { entity: c, type: ctype, holder: entity, prop, parent: pid });
    }
    if (!ix.origins.has(cid) || base[0] === 'changes') ix.origin(cid, [...base, prop, j]);
  }
}

function emptyIndex(): SystemIndex {
  const idx = new Map<string, Entry>();
  const origins = new Map<string, readonly PathSegment[]>();
  return {
    idx,
    origins,
    put: (id, entry) => {
      idx.set(id, entry);
    },
    drop: (id) => {
      idx.delete(id);
    },
    origin: (id, path) => {
      origins.set(id, path);
    },
  };
}

/** Index a (cloned) system by id, so ops can find what they target. */
export function indexSystem(system: SystemSource): SystemIndex {
  const ix = emptyIndex();
  const holder: Rec = { ...system };
  for (const key of collectionKeys()) {
    const type = SYSTEM_COLLECTIONS[key];
    for (const [i, entity] of system[key].entries()) {
      if (!isRecord(entity) || typeof entity.id !== 'string') continue;
      if (!ix.idx.has(entity.id)) {
        ix.put(entity.id, { entity, type, holder, prop: key, parent: null });
      }
      ix.origin(entity.id, [key, i]);
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
  for (const c of listOf(entity, prop) ?? []) {
    const cid = childId(entity.id, ctype, c);
    if (cid !== undefined) ids.push(cid);
  }
  return ids;
}

/** Fill in fields of an op record as the op is applied. */
export function patch(rec: OpRecord, fields: Partial<OpRecord>): void {
  Object.assign(rec, fields);
}

/** Record a problem (or warning) on an op record; `at` is relative to the op. */
export function flag(
  rec: OpRecord,
  note: {
    readonly code: string;
    readonly at: readonly PathSegment[];
    readonly message: string;
    readonly warning?: boolean;
  },
): void {
  const { warning, ...problem } = note;
  if (warning === true) patch(rec, { warnings: [...rec.warnings, problem] });
  else patch(rec, { problems: [...rec.problems, problem] });
}

/** Set a prop on a live entity. */
export function setProp(entity: Rec, prop: string, value: unknown): void {
  Reflect.set(entity, prop, value);
}
