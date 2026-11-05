import { fieldId, isRecord } from '@/application/plan/ids';
import type { Neighbour, Touch, TouchKind } from '@/domain/plan/plan-neighbours';

// Plans stack: a plan reads today with the plans it builds on applied first, in dependency order. Plans that
// neither builds on may change the same thing; that is an overlap, and a warning on both. Only a plan that builds on
// both of them has a problem: what it reads would depend on which went first, and a list order never decides.

type Plans = ReadonlyMap<string, Neighbour>;

const listOf = (value: unknown): readonly Readonly<Record<string, unknown>>[] =>
  Array.isArray(value) ? value.filter((item) => isRecord(item)) : [];

const KINDS: readonly (readonly [string, TouchKind])[] = [
  ['modify', 'change'],
  ['deprecate', 'change'],
  ['remove', 'remove'],
];

/** The id an add op gives what it adds: its own id, or `<schema>#<name>` for a field. */
function addedId(op: Readonly<Record<string, unknown>>): string | null {
  const { value, into } = op;
  if (!isRecord(value)) return null;
  if (typeof value.id === 'string') return value.id;
  return op.add === 'field' && typeof into === 'string' ? fieldId(into, value.name) : null;
}

function touchOf(change: string, op: Readonly<Record<string, unknown>>): Touch | null {
  if (typeof op.add === 'string') {
    const target = addedId(op);
    return target === null ? null : { change, kind: 'add', target };
  }
  for (const [key, kind] of KINDS) {
    const target = op[key];
    if (typeof target === 'string') return { change, kind, target };
  }
  return null;
}

/** What a plan as written adds, changes and removes, change by change. */
export function touchesOf(raw: unknown): Touch[] {
  const changes = isRecord(raw) ? listOf(raw.changes) : [];
  return changes.flatMap((change) => {
    const id = typeof change.id === 'string' ? change.id : '';
    return listOf(change.ops).flatMap((op) => touchOf(id, op) ?? []);
  });
}

/** The open plans a plan reads on top of today, bases first, or the circle that stops them being ordered. */
export type Stack =
  | { readonly order: readonly string[]; readonly cycle: null }
  | { readonly order: null; readonly cycle: readonly string[] };

/**
 * The plans in the `builds_on` closure of a plan, in dependency order: each after the plans it builds on. A
 * landed plan is part of today, so it drops out. A circle anywhere, through the plan itself or among its bases,
 * leaves no order.
 */
export function stackOf(slug: string, buildsOn: readonly string[], plans: Plans): Stack {
  const order: string[] = [];
  const done = new Set<string>();
  const open: string[] = [slug];
  const visit = (each: string): readonly string[] | null => {
    if (open.includes(each)) return [...open.slice(open.indexOf(each)), each];
    if (done.has(each)) return null;
    const plan = plans.get(each);
    if (plan === undefined) return null;
    open.push(each);
    for (const next of plan.buildsOn) {
      const cycle = visit(next);
      if (cycle !== null) return cycle;
    }
    open.pop();
    done.add(each);
    if (!plan.landed) order.push(each);
    return null;
  };
  for (const each of buildsOn) {
    const cycle = visit(each);
    if (cycle !== null) return { order: null, cycle };
  }
  return { order, cycle: null };
}

/** The plans a plan builds on that have not landed yet, in the order they must land. */
export function unlandedBases(slug: string, plans: Plans): readonly string[] {
  const stack = stackOf(slug, plans.get(slug)?.buildsOn ?? [], plans);
  return stack.order ?? stack.cycle.filter((each) => each !== slug);
}

export type OverlapKind = 'modify-modify' | 'remove-change' | 'add-add';

/** Two plans, neither building on the other, that change the same thing. */
export interface Overlap {
  readonly kind: OverlapKind;
  readonly target: string;
  /** The two plans, in name order. */
  readonly plans: readonly [string, string];
  /** The change in each plan that does it, qualified as `<plan>/<change>`. */
  readonly changes: readonly [string, string];
}

const rootOf = (id: string): string => id.split('#', 1)[0] ?? id;

const within = (part: string, whole: string): boolean => part.startsWith(`${whole}#`);

/** How two touches clash, and on what: the same thing, or a part of a thing the other removes. */
function clashOf(
  a: Touch,
  b: Touch,
): { readonly kind: OverlapKind; readonly target: string } | null {
  if (a.target === b.target) {
    if (a.kind === 'add' || b.kind === 'add') {
      return a.kind === b.kind ? { kind: 'add-add', target: a.target } : null;
    }
    const kind = a.kind === 'remove' || b.kind === 'remove' ? 'remove-change' : 'modify-modify';
    return { kind, target: a.target };
  }
  if (a.kind === 'remove' && within(b.target, a.target)) {
    return { kind: 'remove-change', target: a.target };
  }
  if (b.kind === 'remove' && within(a.target, b.target)) {
    return { kind: 'remove-change', target: b.target };
  }
  return null;
}

/** Every plan each plan reaches through builds_on. */
function reachOf(plans: Plans): ReadonlyMap<string, ReadonlySet<string>> {
  const reach = new Map<string, Set<string>>();
  const from = (slug: string): Set<string> => {
    const known = reach.get(slug);
    if (known !== undefined) return known;
    const found = new Set<string>();
    reach.set(slug, found);
    for (const next of plans.get(slug)?.buildsOn ?? []) {
      found.add(next);
      for (const further of from(next)) found.add(further);
    }
    return found;
  };
  for (const slug of plans.keys()) from(slug);
  return reach;
}

interface Placed extends Touch {
  readonly plan: string;
}

function pairsOf(touches: readonly Placed[], ordered: (a: string, b: string) => boolean) {
  return touches.flatMap((a, i) =>
    touches
      .slice(i + 1)
      .filter((b) => a.plan !== b.plan && !ordered(a.plan, b.plan))
      .map((b) => (a.plan.localeCompare(b.plan) <= 0 ? ([a, b] as const) : ([b, a] as const))),
  );
}

/** The touches of the open plans compared, grouped by the thing (or the thing holding the part) they touch. */
function byRootOf(plans: Plans, among: ReadonlySet<string> | undefined): Map<string, Placed[]> {
  const byRoot = new Map<string, Placed[]>();
  for (const [plan, neighbour] of plans) {
    if (neighbour.landed || (among !== undefined && !among.has(plan))) continue;
    for (const touch of neighbour.touches) {
      const root = rootOf(touch.target);
      byRoot.set(root, [...(byRoot.get(root) ?? []), { ...touch, plan }]);
    }
  }
  return byRoot;
}

const keyOf = (overlap: Overlap): string => `${overlap.target}\n${overlap.changes.join('\n')}`;

function overlapOf(a: Placed, b: Placed): Overlap | null {
  const clash = clashOf(a, b);
  if (clash === null) return null;
  const changes = [`${a.plan}/${a.change}`, `${b.plan}/${b.change}`] as const;
  return { ...clash, plans: [a.plan, b.plan], changes };
}

/**
 * Every pair of open plans, neither building on the other, whose changes touch the same thing: both modify it,
 * one removes what the other changes (or a part of it), or both add it. `among` narrows the plans compared.
 */
export function overlapsOf(plans: Plans, among?: ReadonlySet<string>): Overlap[] {
  const reach = reachOf(plans);
  const ordered = (a: string, b: string): boolean =>
    reach.get(a)?.has(b) === true || reach.get(b)?.has(a) === true;
  const found = new Map<string, Overlap>();
  for (const touches of byRootOf(plans, among).values()) {
    for (const [a, b] of pairsOf(touches, ordered)) {
      const overlap = overlapOf(a, b);
      if (overlap !== null && !found.has(keyOf(overlap))) found.set(keyOf(overlap), overlap);
    }
  }
  return [...found.values()].toSorted((x, y) => keyOf(x).localeCompare(keyOf(y)));
}

const VERBS: Record<OverlapKind, string> = {
  'modify-modify': 'both change',
  'remove-change': 'one removes what the other changes:',
  'add-add': 'both add',
};

/** An overlap in words, as seen from one of its plans. */
export function overlapWords(overlap: Overlap, slug: string): string {
  const first = overlap.plans[0] === slug;
  const other = first ? overlap.plans[1] : overlap.plans[0];
  const [a, b] = overlap.changes;
  const changes = first ? `${a} and ${b}` : `${b} and ${a}`;
  return `overlaps ${other} (${overlap.kind}): ${VERBS[overlap.kind]} ${overlap.target} (${changes}). Neither builds on the other, so a plan that builds on both cannot be read; order them, or agree which one changes it`;
}

/** The hashes a plan was checked against: each open plan it builds on, and its programme. */
export interface StackHashes {
  readonly bases: Readonly<Record<string, string>>;
  readonly programme: { readonly id: string; readonly hash: string } | null;
}

/** What has changed since the plan was checked: the bases whose hash moved (or were not checked), and the programme. */
export function changedSince(
  locked: StackHashes,
  now: StackHashes,
): { readonly bases: readonly string[]; readonly programme: boolean } {
  const bases = Object.entries(now.bases)
    .filter(([slug, hash]) => locked.bases[slug] !== hash)
    .map(([slug]) => slug);
  const programme =
    now.programme !== null &&
    (locked.programme?.id !== now.programme.id || locked.programme.hash !== now.programme.hash);
  return { bases, programme };
}
