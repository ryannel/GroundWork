import type { Field } from '@/domain/plan/plan.generated';

export type Verdict = 'breaking' | 'migration' | 'safe';
export type Role = 'request' | 'record' | 'response' | 'payload' | 'graph' | 'shape';
type Who = 'caller' | 'consumer' | 'operation' | 'reader' | 'writer';

/** The roles a schema plays: a record (kept in a store), the body of endpoints, the payload of messages. */
export interface Roles {
  readonly record: boolean;
  readonly request: readonly string[];
  readonly response: readonly string[];
  readonly payload: readonly string[];
  readonly graph: boolean;
}

export interface Rule {
  readonly verdict: Verdict;
  readonly rule: string;
  readonly text: string;
  readonly who: Who;
}

export interface RoleRule extends Rule {
  readonly role: Role;
}

type Shape = Partial<Field>;

const RANK: Record<Verdict, number> = { safe: 0, migration: 1, breaking: 2 };

export const worse = (a: Verdict | null | undefined, b: Verdict): Verdict =>
  RANK[b] > RANK[a ?? 'safe'] ? b : (a ?? 'safe');

export const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const baseType = (t: string | undefined): string => (t ?? '').trim().replace(/\?$/u, '').trim();

function enumOf(t: string | undefined): string[] | null {
  const base = baseType(t);
  if (!base.startsWith('enum(') || !base.endsWith(')')) return null;
  return base
    .slice(5, -1)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

const given = (v: unknown): boolean => v !== undefined && v !== null && v !== false && v !== '';

function roleList(roles: Roles): Role[] {
  const list: Role[] = [];
  if (roles.request.length > 0) list.push('request');
  if (roles.record) list.push('record');
  if (roles.response.length > 0) list.push('response');
  if (roles.payload.length > 0) list.push('payload');
  if (roles.graph) list.push('graph');
  // a schema nothing points at is read like a response
  return list.length > 0 ? list : ['shape'];
}

const rule = ([verdict, id]: readonly [Verdict, string], text: string, who: Who): Rule => ({
  verdict,
  rule: id,
  text,
  who,
});

function requiredRule(role: Role, now: Shape, why: string): Rule | null {
  if (role === 'request') {
    return rule(['breaking', 'add-required-request'], `${why}; callers must send it`, 'caller');
  }
  if (role !== 'record') return null; // a required field on a response or payload is information, not a break
  return given(now.default)
    ? rule(['safe', 'add-required-default'], `existing rows get ${String(now.default)}`, 'writer')
    : rule(['migration', 'add-required-stored'], 'existing rows need a value', 'writer');
}

function readerOf(role: Role): Who {
  if (role === 'request') return 'caller';
  if (role === 'payload') return 'consumer';
  return role === 'graph' ? 'operation' : 'reader';
}

function typeRules(role: Role, was: Shape, now: Shape): Rule[] {
  if (baseType(was.type) === baseType(now.type)) return [];
  const reader = readerOf(role);
  const [a, b] = [enumOf(was.type), enumOf(now.type)];
  if (a === null || b === null) {
    const text = `type changes from ${baseType(was.type)} to ${baseType(now.type)}`;
    return [rule(['breaking', 'type-change'], text, reader)];
  }
  const lost = a.filter((x) => !b.includes(x));
  const gained = b.filter((x) => !a.includes(x));
  if (lost.length > 0) {
    return [rule(['breaking', 'enum-loses'], `values removed: ${lost.join(', ')}`, reader)];
  }
  return gained.length > 0 && role !== 'request'
    ? [rule(['migration', 'enum-gains'], `readers must handle ${gained.join(', ')}`, reader)]
    : [];
}

function requiredRules(role: Role, was: Shape, now: Shape): Rule[] {
  const [wasReq, nowReq] = [was.required === true, now.required === true];
  if (!wasReq && nowReq) {
    const r = requiredRule(role, now, 'becomes required');
    return r === null ? [] : [r];
  }
  if (wasReq && !nowReq && role !== 'request') {
    const text = 'may now be absent; readers must handle that';
    return [rule(['breaking', 'required-to-optional'], text, readerOf(role))];
  }
  return [];
}

function constraintRules(role: Role, was: Shape, now: Shape): Rule[] {
  if (role !== 'record') return [];
  return (['key', 'unique', 'ref'] as const)
    .filter((k) => !given(was[k]) && given(now[k]))
    .map((k) =>
      rule(
        ['migration', 'constraint-added'],
        `${k === 'ref' ? 'a reference' : k} added; existing rows must satisfy it`,
        'writer',
      ),
    );
}

/** Rules for one field under one role. `was` / `now` are the field before and after (undefined = added / removed). */
function rulesFor(role: Role, was: Shape | undefined, now: Shape | undefined): Rule[] {
  if (was === undefined) {
    const r = now?.required === true ? requiredRule(role, now, 'a new required field') : null;
    return r === null ? [] : [r];
  }
  if (now === undefined) {
    return [rule(['breaking', 'remove'], 'the field is removed', readerOf(role))];
  }
  return [
    ...typeRules(role, was, now),
    ...requiredRules(role, was, now),
    ...constraintRules(role, was, now),
  ];
}

/** The compatibility rule for one field edit, over every role its schema plays. */
export function fieldRule(
  roles: Roles,
  was: Shape | undefined,
  now: Shape | undefined,
): { readonly verdict: Verdict; readonly rules: readonly RoleRule[] } {
  const rules = roleList(roles).flatMap((role) =>
    rulesFor(role, was, now).map((r) => ({ ...r, role })),
  );
  return { verdict: rules.reduce<Verdict>((v, r) => worse(v, r.verdict), 'safe'), rules };
}

/* what changes between the as-is and the to-be, entity by entity */

const CHILD_KEYS = new Set(['fields', 'endpoints', 'steps', 'regions']);
const skipped = (k: string): boolean =>
  k.startsWith('$') || k === 'id' || k === 'sources' || CHILD_KEYS.has(k);

export interface PropRow {
  readonly prop: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly status: 'added' | 'removed' | 'modified';
}

const nullish = (v: unknown): boolean => v === null || v === undefined;

/** Prop-level differences of two entities, children left out. */
export function propRows(a: object | undefined, b: object | undefined): PropRow[] {
  const left = new Map<string, unknown>(Object.entries(a ?? {}));
  const right = new Map<string, unknown>(Object.entries(b ?? {}));
  const rows: PropRow[] = [];
  for (const k of new Set([...left.keys(), ...right.keys()])) {
    const [x, y] = [left.get(k), right.get(k)];
    if (skipped(k) || sameJson(x, y)) continue;
    let status: PropRow['status'] = 'modified';
    if (nullish(x)) status = 'added';
    else if (nullish(y)) status = 'removed';
    rows.push({ prop: k, before: x ?? null, after: y ?? null, status });
  }
  return rows;
}
