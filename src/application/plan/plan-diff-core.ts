// What a plan diff is made of: its types and the small readers every part of the diff shares.

import { isRecord, prop, type Rec } from '@/application/plan/ids';
import { PLAN_COLLECTIONS, SYSTEM_COLLECTIONS } from '@/domain/plan/plan-ids';

export interface OpLine {
  index: number;
  summary: string;
}
export interface EditedOp extends OpLine {
  fromIndex: number;
  fields: string[];
}
export interface ChangeOps {
  change: string;
  title: string;
  status: 'added' | 'removed' | 'changed';
  added: OpLine[];
  removed: OpLine[];
  edited: EditedOp[];
}
export interface EntityDiff {
  added: string[];
  removed: string[];
  changed: { id: string; keys: string[] }[];
}
export interface MovedMilestone {
  id: string;
  name: string;
  fromDue: string | null;
  toDue: string | null;
  fromIndex: number;
  toIndex: number;
}
export interface PlanMeta {
  version: string | null;
  date: string | null;
  status: string | null;
}
export interface PlanDiff {
  from: PlanMeta;
  to: PlanMeta;
  title: string;
  entities: Record<string, EntityDiff>;
  ops: ChangeOps[];
  questions: { opened: string[]; resolved: string[]; reopened: string[] };
  workItems: {
    added: string[];
    removed: string[];
    remilestoned: { id: string; from: string | null; to: string | null }[];
  };
  milestones: { moved: MovedMilestone[] };
  empty: boolean;
}

export type Entities = Map<string, Rec>;
export type Collections = Record<string, Entities>;

export const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
export const textOr = (v: unknown, fallback: string): string => text(v) ?? fallback;
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const none = (): Entities => new Map<string, Rec>();
export const keysOf = (v: unknown): string[] => (isRecord(v) ? Object.keys(v) : []);

const alphabetical = (a: string, b: string): number => a.localeCompare(b);

/** JSON with sorted keys, so equal values compare equal regardless of key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isRecord(v)) {
    const body = Object.keys(v)
      .toSorted(alphabetical)
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`);
    return `{${body.join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** The keys at which two values differ, in alphabetical order. */
export const differing = (x: unknown, y: unknown): string[] =>
  [...new Set([...keysOf(x), ...keysOf(y)])]
    .filter((k) => canonical(prop(x, k)) !== canonical(prop(y, k)))
    .toSorted(alphabetical);

const byId = (items: unknown): Entities =>
  new Map(
    list(items)
      .filter(isRecord)
      .flatMap((e): [string, Rec][] => {
        const id = text(e.id);
        return id === null ? [] : [[id, e]];
      }),
  );

/** Every top-level collection that holds id'd entities (plus the problem's scenarios and the domain's concepts and stages). */
export function collections(plan: unknown): Collections {
  const out: Collections = {};
  for (const key of [...Object.keys(SYSTEM_COLLECTIONS), ...Object.keys(PLAN_COLLECTIONS)])
    out[key] = byId(prop(plan, key));
  out.scenarios = byId(prop(prop(plan, 'problem'), 'scenarios'));
  out.concepts = byId(prop(prop(plan, 'domain'), 'concepts'));
  out.stages = byId(prop(prop(plan, 'domain'), 'stages'));
  return out;
}
