import { createCompat } from '@/application/plan/compat';
import type { Verdict } from '@/application/plan/compat-rules';
import { baseId, changedKeys, type Planned, typeName } from '@/application/plan/impact-planned';
import type { Field, Schema, Step } from '@/domain/plan/plan.generated';

/** A field the revision adds, edits or removes, with its verdict from the one compatibility rule. */
export interface FieldDelta {
  schema: string;
  name: string;
  kind: 'added' | 'edited' | 'removed';
  before: Field | null;
  after: Field | null;
  keys: string[];
  /** Only its note or description changes. */
  cosmetic: boolean;
  verdict: Verdict;
  /** A reader the revision does not move is affected. */
  breaking: boolean;
  stored: boolean;
}

/** A schema whose shape changes: its own field deltas, or the holder it reaches them through. */
export interface Shaped {
  direct: FieldDelta[];
  via?: { field: string; of: string };
}

export type Shape = Map<string, Shaped>;

/** The two planned systems of a revision, and the shape that changes between them. */
export interface Sides {
  A: Planned;
  B: Planned;
  shape: Shape;
}

type VerdictOf = (id: string) => Verdict;

const COSMETIC = new Set(['note', 'description']);

function deltasOf(before: Schema, after: Schema, verdictOf: VerdictOf): FieldDelta[] {
  const [fa, fb] = [
    new Map((before.fields ?? []).map((f) => [f.name, f])),
    new Map((after.fields ?? []).map((f) => [f.name, f])),
  ];
  const stored = after.store !== undefined || before.store !== undefined;
  const make = (
    name: string,
    was: Field | undefined,
    now: Field | undefined,
  ): FieldDelta | null => {
    const verdict = verdictOf(`${after.id}#${name}`);
    const base = { schema: after.id, name, verdict, breaking: verdict === 'breaking', stored };
    if (was === undefined && now !== undefined) {
      return { ...base, kind: 'added', before: null, after: now, keys: [], cosmetic: false };
    }
    if (now === undefined && was !== undefined) {
      return { ...base, kind: 'removed', before: was, after: null, keys: [], cosmetic: false };
    }
    if (was === undefined || now === undefined) return null;
    const keys = changedKeys(was, now, ['name']);
    if (keys.length === 0) return null;
    const cosmetic = keys.every((k) => COSMETIC.has(k));
    return { ...base, kind: 'edited', before: was, after: now, keys, cosmetic };
  };
  const names = [...new Set([...fb.keys(), ...fa.keys()])];
  return names.flatMap((n) => make(n, fa.get(n), fb.get(n)) ?? []);
}

/**
 * Every field the revision adds, edits or removes, with its verdict from the one compatibility rule (compat.ts):
 * breaking (a reader the revision does not move), needs migration, or safe.
 */
export function fieldDeltas(A: Planned, B: Planned): FieldDelta[] {
  const cc = createCompat({ asIs: A.g, toBe: B.g });
  const verdictOf: VerdictOf = (id) => cc.compat(id)?.verdict ?? 'safe';
  const ids = new Set([...A.schemas.keys(), ...B.schemas.keys()]);
  return [...ids].flatMap((id) => {
    const [a, b] = [A.schemas.get(id), B.schemas.get(id)];
    // a whole new or dropped schema is the steps' and changes' story, not a field's
    return a === undefined || b === undefined ? [] : deltasOf(a, b, verdictOf);
  });
}

/** The schemas not yet shaped that hold one that is (Order.billing is a BillingIdentity). */
function holders(B: Planned, shape: Shape): [string, Shaped][] {
  const names = new Map<string, string>();
  for (const id of shape.keys()) {
    const name = B.schemas.get(id)?.name;
    if (name !== undefined && name !== '') names.set(name, id);
  }
  const found: [string, Shaped][] = [];
  for (const [id, s] of B.schemas) {
    if (shape.has(id)) continue;
    const field = (s.fields ?? []).find((f) => names.has(typeName(f.type)));
    const of = field === undefined ? undefined : names.get(typeName(field.type));
    if (field !== undefined && of !== undefined)
      found.push([id, { direct: [], via: { field: field.name, of } }]);
  }
  return found;
}

/** Schemas whose shape changes in B, directly or by holding one that does. */
export function shapes(B: Planned, deltas: readonly FieldDelta[]): Shape {
  const out: Shape = new Map();
  for (const d of deltas.filter((x) => !x.cosmetic)) {
    const shaped = out.get(d.schema) ?? { direct: [] };
    shaped.direct.push(d);
    out.set(d.schema, shaped);
  }
  for (let more = holders(B, out); more.length > 0; more = holders(B, out)) {
    for (const [id, s] of more) out.set(id, s);
  }
  return out;
}

/** The fields that actually change, following holders down. */
export function rootFields(shape: Shape, id: string, seen = new Set<string>()): FieldDelta[] {
  const s = shape.get(id);
  if (s === undefined || seen.has(id)) return [];
  seen.add(id);
  if (s.direct.length > 0) return s.direct;
  return s.via === undefined ? [] : rootFields(shape, s.via.of, seen);
}

/** The schemas a step moves: what it reads and writes, its message's payload, its endpoint's request and response. */
export function dataOf(P: Planned, step: Step): string[] {
  const ids = [...(step.reads ?? []), ...(step.writes ?? [])].map(baseId);
  const msg = P.messages.get(step.via);
  const ep = P.endpoints.get(step.via);
  for (const ref of [msg?.payload, ep?.request, ep?.response]) {
    if (ref !== undefined) ids.push(baseId(ref));
  }
  return [...new Set(ids.filter((x) => x !== ''))];
}
