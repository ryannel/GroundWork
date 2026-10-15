import { opKind } from '@/application/plan/graph-queries';
import { fieldId, isRecord, type Rec } from '@/application/plan/ids';
import {
  collectionKeyOf,
  flag,
  indexChildren,
  patch,
  selfAndChildren,
  setProp,
  type SystemIndex,
} from '@/application/plan/ops-index';
import type { OpRecord, SystemSource } from '@/domain/plan/plan-graph';
import { ADD_TYPES, CHILDREN, type ContainerType } from '@/domain/plan/plan-ids';
import type { Change, Op, OpAdd } from '@/domain/plan/plan.generated';

export interface Applying {
  system: SystemSource;
  ix: SystemIndex;
}

export function newRecord(chg: Change, [ci, oi]: readonly [number, number], op: Op): OpRecord {
  return {
    kind: opKind(op),
    changeId: chg.id,
    changeIndex: ci,
    opIndex: oi,
    path: ['changes', ci, 'ops', oi],
    target: null,
    type: null,
    ids: [],
    props: [],
    problems: [],
    warnings: [],
  };
}

const intoOf = (op: OpAdd): string | undefined => ('into' in op ? op.into : undefined);

/** The children list of the container an add goes into, or null (with a problem on the record). */
function childList(
  ix: SystemIndex,
  { op, container }: { op: OpAdd; container: ContainerType },
  rec: OpRecord,
): unknown[] | null {
  const into = intoOf(op);
  patch(rec, { parent: into ?? null });
  if (into === undefined) {
    flag(rec, {
      code: 'into',
      at: ['into'],
      message: `add ${op.add} needs "into" (a ${container} id)`,
    });
    return null;
  }
  const parent = ix.idx.get(into);
  if (parent === undefined) {
    flag(rec, {
      code: 'into',
      at: ['into'],
      message: `${into} does not exist at this point in the changes list; fix the id, or move the op that adds it earlier`,
    });
    return null;
  }
  if (parent.type !== container) {
    flag(rec, {
      code: 'into',
      at: ['into'],
      message: `${into} is a ${parent.type}, expected a ${container} (fields go into sch:…, endpoints into if:…, steps into flow:…, regions into scr:…)`,
    });
    return null;
  }
  const prop = CHILDREN[container][0];
  if (!Array.isArray(parent.entity[prop])) setProp(parent.entity, prop, []);
  const list: unknown = parent.entity[prop];
  return Array.isArray(list) ? list : null;
}

/** The list an added entity goes into (a base array, or its container's children), or null. */
function addTarget({ system, ix }: Applying, op: OpAdd, rec: OpRecord): unknown[] | null {
  const container = ADD_TYPES[op.add];
  if (container !== null) return childList(ix, { op, container }, rec);
  const key = collectionKeyOf(op.add);
  if (key === undefined) return null;
  const list: unknown[] = system[key];
  return list;
}

/** Where a step goes: after a named sibling, else at the end. */
function stepPosition(op: OpAdd, list: unknown[], rec: OpRecord): number {
  const after = 'after' in op ? op.after : undefined;
  if (op.add !== 'step' || after === undefined) return list.length;
  const i = list.findIndex((s) => isRecord(s) && s.id === after);
  if (i !== -1) return i + 1;
  flag(rec, {
    code: 'after',
    at: ['after'],
    message: `${after} is not a step of ${intoOf(op) ?? ''} at this point in the changes list; point after at an existing sibling step, or omit it to append`,
  });
  return list.length;
}

function checkChildId(op: OpAdd, value: Rec, rec: OpRecord): void {
  const into = intoOf(op) ?? '';
  const child = op.add === 'step' || op.add === 'region';
  if (child && typeof value.id === 'string' && !value.id.startsWith(`${into}#`)) {
    flag(rec, {
      code: 'child-id',
      at: ['value', 'id'],
      message: `${op.add} id ${value.id} must start with ${into}#; rename the ${op.add} or fix into`,
    });
  }
}

/** What goes in, and the list it goes into. */
interface Placement {
  op: OpAdd;
  id: string;
  value: Rec;
  list: unknown[];
}

function place(ix: SystemIndex, at: Placement, rec: OpRecord): void {
  const { op, id, value, list } = at;
  const pos = stepPosition(op, list, rec);
  const before: unknown = pos > 0 ? list[pos - 1] : undefined;
  const afterId =
    op.add === 'step' && isRecord(before) && typeof before.id === 'string' ? before.id : null;
  list.splice(pos, 0, value);
  const base = [...rec.path, 'value'];
  ix.idx.set(id, { entity: value, type: op.add, list, parent: intoOf(op) ?? null });
  ix.origins.set(id, base);
  indexChildren(ix, { entity: value, type: op.add, base });
  patch(rec, {
    afterId,
    ids: op.add === 'field' ? [id] : selfAndChildren(value, op.add),
    value: structuredClone(value),
  });
}

export function applyAdd(scope: Applying, op: OpAdd, rec: OpRecord): void {
  patch(rec, { type: op.add });
  const value: unknown = structuredClone(op.value);
  const list = addTarget(scope, op, rec);
  if (list === null || !isRecord(value)) return;
  const id = op.add === 'field' ? fieldId(intoOf(op) ?? '', value.name) : value.id;
  if (typeof id !== 'string') return;
  patch(rec, { target: id });
  if (scope.ix.idx.has(id)) {
    flag(rec, {
      code: 'collision',
      at: ['value'],
      message: `${id} already exists; add ids must be new`,
    });
    return;
  }
  checkChildId(op, value, rec);
  place(scope.ix, { op, id, value, list }, rec);
}
