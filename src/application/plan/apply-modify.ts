import type { Rec } from '@/application/plan/ids';
import {
  flag,
  isContainer,
  listOf,
  patch,
  selfAndChildren,
  setProp,
  type Entry,
  type SystemIndex,
} from '@/application/plan/ops-index';
import type { OpRecord } from '@/domain/plan/plan-graph';
import { CHILDREN, type PathSegment } from '@/domain/plan/plan-ids';
import type { Op, OpModify } from '@/domain/plan/plan.generated';

/** Stable JSON equality for list items (ids or small objects). */
const same = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** The entity a modify op edits, and the prop that holds its children (those change by add/remove). */
interface Target {
  readonly entity: Rec;
  readonly childProp: string | undefined;
}

function applySet(t: Target, op: OpModify, rec: OpRecord): void {
  const isField = rec.type === 'field';
  for (const [prop, v] of Object.entries(op.set ?? {})) {
    if (prop === 'id' || prop === t.childProp || (isField && prop === 'name')) {
      flag(rec, {
        code: 'immutable',
        at: ['set', prop],
        message: `${prop} cannot be modified; use remove + add instead`,
      });
      continue;
    }
    const before: unknown = structuredClone(t.entity[prop]);
    if (same(before, v)) {
      flag(rec, {
        code: 'noop',
        at: ['set', prop],
        message: 'value is unchanged (no-op); delete it from set, or fix the value',
        warning: true,
      });
    }
    setProp(t.entity, prop, structuredClone(v));
    patch(rec, {
      props: [...rec.props, { prop, change: 'set', before, after: structuredClone(v) }],
    });
  }
}

type ListChange = 'append' | 'drop';

function listAfter(
  change: ListChange,
  { before, values }: { readonly before: readonly unknown[]; readonly values: readonly unknown[] },
  noop: (m: string) => void,
): unknown[] {
  if (change === 'append') {
    for (const v of values) {
      if (before.some((b) => same(b, v))) {
        noop(`${JSON.stringify(v)} is already present; drop it from append`);
      }
    }
    return [...before, ...structuredClone(values)];
  }
  for (const v of values) {
    if (!before.some((b) => same(b, v))) {
      noop(`${JSON.stringify(v)} is not present; drop it from drop, or fix the value`);
    }
  }
  return before.filter((b) => !values.some((v) => same(b, v)));
}

function applyOneList(
  t: Target,
  [change, prop, values]: readonly [ListChange, string, readonly unknown[]],
  rec: OpRecord,
): void {
  const cur: unknown = t.entity[prop];
  const at = [change, prop];
  if (prop === t.childProp) {
    flag(rec, {
      code: 'immutable',
      at,
      message:
        'children are changed with add/remove ops; use add: step/field/endpoint with into, or remove',
    });
    return;
  }
  if (cur !== undefined && cur !== null && !Array.isArray(cur)) {
    flag(rec, {
      code: 'not-list',
      at,
      message: `${prop} is not a list; use set: { ${prop}: … } instead`,
    });
    return;
  }
  const before: unknown[] = structuredClone(Array.isArray(cur) ? cur : []);
  const noop = (message: string): void => {
    flag(rec, { code: 'noop', at, message, warning: true });
  };
  const after = listAfter(change, { before, values }, noop);
  setProp(t.entity, prop, after);
  patch(rec, {
    props: [
      ...rec.props,
      { prop, change, before, after: structuredClone(after), values: structuredClone(values) },
    ],
  });
}

function applyListChange(t: Target, op: OpModify, rec: OpRecord): void {
  for (const change of ['append', 'drop'] as const) {
    for (const [prop, values] of Object.entries(op[change] ?? {})) {
      applyOneList(t, [change, prop, values], rec);
    }
  }
}

function targetOf(op: Op): string | null {
  if ('modify' in op) return op.modify;
  if ('deprecate' in op) return op.deprecate;
  return 'remove' in op ? op.remove : null;
}

/** What the targeted ops share: the live index, and which ids earlier ops removed (filled by the caller). */
export interface Targeting {
  readonly ix: SystemIndex;
  readonly removedBy: ReadonlyMap<string, readonly PathSegment[]>;
}

function flagMissing(scope: Targeting, target: string, rec: OpRecord): void {
  const at = [rec.kind ?? 'remove'];
  if (scope.removedBy.has(target)) {
    flag(rec, {
      code: 'removed',
      at,
      message: `${target} was already removed earlier in the changes list; delete this op, or move it before the remove`,
    });
  } else {
    flag(rec, {
      code: 'missing',
      at,
      message: `${target} does not exist at this point in the changes list`,
    });
  }
}

function applyRemove(scope: Targeting, hit: Entry, rec: OpRecord): void {
  const ids = hit.type === 'field' ? [rec.target ?? ''] : selfAndChildren(hit.entity, hit.type);
  const list = listOf(hit.holder, hit.prop);
  const i = list?.indexOf(hit.entity) ?? -1;
  if (i !== -1) list?.splice(i, 1);
  for (const id of ids) scope.ix.drop(id);
  patch(rec, { removed: structuredClone(hit.entity), ids });
}

export function applyTargeted(scope: Targeting, op: Op, rec: OpRecord): void {
  const target = targetOf(op);
  if (target === null) return;
  patch(rec, { target });
  const hit = scope.ix.idx.get(target);
  if (hit === undefined) {
    flagMissing(scope, target, rec);
    return;
  }
  patch(rec, { type: hit.type, ids: [target] });
  if ('modify' in op) {
    const t: Target = {
      entity: hit.entity,
      childProp: isContainer(hit.type) ? CHILDREN[hit.type][0] : undefined,
    };
    applySet(t, op, rec);
    applyListChange(t, op, rec);
    scope.ix.origin(target, rec.path);
  } else if ('deprecate' in op) {
    patch(rec, { replacedBy: op.replaced_by ?? null });
  } else {
    applyRemove(scope, hit, rec);
  }
}
