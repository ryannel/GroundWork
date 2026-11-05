import type { PlanEntity, PlanEntry } from '@/domain/plan/plan-graph';
import { PLAN_COLLECTIONS, REFS, type EntityType, type PathSegment } from '@/domain/plan/plan-ids';
import type { Plan } from '@/domain/plan/plan.generated';

export type Rec = Record<string, unknown>;

export function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A prop of anything that might be an object; undefined otherwise. */
export function prop(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

export {
  planEntityTypeOf as typeOf,
  qualifiedOf,
  parentOf,
  childId as fieldId,
} from '@/domain/ids';

const CITE_RE = /\[\[([^\]\s]{1,200})\]\]/gu;

/** All `[[id]]` citations in a string. */
export function citationsIn(text: unknown): string[] {
  if (typeof text !== 'string' || !text.includes('[[')) return [];
  return [...text.matchAll(CITE_RE)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));
}

/** Call `fn` for every string in a value, with its path from the root passed in. */
export function walkStrings(
  value: unknown,
  fn: (text: string, path: readonly PathSegment[]) => void,
  path: readonly PathSegment[] = [],
): void {
  if (typeof value === 'string') fn(value, path);
  else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) walkStrings(v, fn, [...path, i]);
  } else if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) walkStrings(v, fn, [...path, k]);
  }
}

/** ['changes', 3, 'ops', 1, 'modify'] → 'changes[3].ops[1].modify' */
export function formatPath(segments: readonly PathSegment[]): string {
  let out = '';
  for (const s of segments) {
    if (typeof s === 'number' || /^\d+$/u.test(s)) out += `[${String(s)}]`;
    else out += out === '' ? s : `.${s}`;
  }
  return out === '' ? '(root)' : out;
}

/** JSON pointer ('/changes/3/ops/1') → segments. */
export function pointerToSegments(pointer: string): PathSegment[] {
  if (pointer === '') return [];
  return pointer
    .split('/')
    .slice(1)
    .map((s) => {
      const k = s.replaceAll('~1', '/').replaceAll('~0', '~');
      return /^\d+$/u.test(k) ? Number(k) : k;
    });
}

export interface EntityRef {
  readonly prop: string;
  readonly path: readonly PathSegment[];
  readonly id: string;
  /** Allowed target types; null means any. */
  readonly expect: readonly EntityType[] | null;
}

const SPEC = /^(\w+)(\[\])?(?:\.(\w+)(\[\])?)?$/u;

function refsOfSpec(spec: string, expect: EntityRef['expect'], entity: unknown): EntityRef[] {
  const m = SPEC.exec(spec);
  const name = m?.[1];
  const sub = m?.[3];
  const value = name === undefined ? undefined : prop(entity, name);
  if (m === null || name === undefined || value === undefined || value === null) return [];
  const one = (id: unknown, path: readonly PathSegment[]): EntityRef[] =>
    typeof id === 'string' ? [{ prop: name, path, id, expect }] : [];
  if (m[2] !== undefined) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: unknown, i) => {
      if (m[4] === undefined || sub === undefined) {
        return one(
          sub === undefined ? item : prop(item, sub),
          sub === undefined ? [name, i] : [name, i, sub],
        );
      }
      const list = prop(item, sub);
      return Array.isArray(list)
        ? list.flatMap((id: unknown, j) => one(id, [name, i, sub, j]))
        : [];
    });
  }
  return one(
    sub === undefined ? value : prop(value, sub),
    sub === undefined ? [name] : [name, sub],
  );
}

/**
 * Enumerate the refs an entity holds. Children (steps, fields, endpoints) are not descended,
 * and `internal` is not a ref when it is a step's `via`.
 */
export function refsOf(type: EntityType, entity: unknown): EntityRef[] {
  return REFS[type]
    .flatMap(([spec, expect]) => refsOfSpec(spec, expect, entity))
    .filter((r) => !(type === 'step' && r.prop === 'via' && r.id === 'internal'));
}

type PlanKey = keyof typeof PLAN_COLLECTIONS;

function entriesOf(
  list: readonly PlanEntity[] | undefined,
  type: EntityType,
  path: readonly PathSegment[],
) {
  return (list ?? []).map((entity, i): PlanEntry => ({
    id: entity.id,
    type,
    entity,
    path: [...path, i],
  }));
}

/**
 * Every plan-level entity outside the system graphs: the PLAN_COLLECTIONS, each change's requirements,
 * problem.scenarios, domain.concepts and domain.stages, in plan order.
 */
export function planEntries(plan: Plan): PlanEntry[] {
  const keys: PlanKey[] = [
    'changes',
    'tests',
    'milestones',
    'work_items',
    'decisions',
    'risks',
    'questions',
  ];
  const out = keys.flatMap((key) => entriesOf(plan[key], PLAN_COLLECTIONS[key], [key]));
  for (const [i, change] of (plan.changes ?? []).entries()) {
    out.push(...entriesOf(change.requires, 'requirement', ['changes', i, 'requires']));
  }
  out.push(
    ...entriesOf(plan.problem.scenarios, 'scenario', ['problem', 'scenarios']),
    ...entriesOf(plan.domain?.concepts, 'concept', ['domain', 'concepts']),
    ...entriesOf(plan.domain?.stages, 'stage', ['domain', 'stages']),
  );
  return out;
}

/** A short display label for any entity. */
export function labelOf(entity: unknown, id: string): string {
  for (const key of ['name', 'title', 'action', 'sig', 'term', 'statement', 'question', 'text']) {
    const v = prop(entity, key);
    if (typeof v === 'string' || typeof v === 'number') return String(v);
  }
  return id;
}
