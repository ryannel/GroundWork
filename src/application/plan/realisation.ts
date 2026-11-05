import { systemOf } from '@/application/plan/graph';
import { fieldId, prop, type Rec } from '@/application/plan/ids';
import { indexSystem } from '@/application/plan/ops-index';
import { canonical } from '@/application/plan/plan-diff-core';
import { rootId } from '@/domain/ids';
import type { SystemSource } from '@/domain/plan/plan-graph';
import type { Change, Op, OpAdd, OpModify, Plan } from '@/domain/plan/plan.generated';
import type { Origin } from '@/domain/workspace-model';

// Realisation: whether today's model now says what a plan's ops said, op by op and rolled up to each change. It
// is compared with today as the scans and documents read it, never with the base a stacked plan is read on, and
// only a fact with authority counts: one read from code or written by people, or a partner's own document.

/** How far today says what an op said. */
export type RealisationState = 'missing' | 'partial' | 'matches' | 'differs';

/** One op compared with today: its place in the change, what it targets, and in words why it reads so. */
export interface OpRealisation {
  readonly op: number;
  readonly target: string | null;
  readonly state: RealisationState;
  readonly detail: string;
}

/** A change compared with today: its ops, rolled up. */
export interface ChangeRealisation {
  readonly change: string;
  readonly state: RealisationState;
  readonly ops: readonly OpRealisation[];
}

/** What realisation reads of today: the system, who said each fact, and which teams are partners. */
export interface TodayFacts {
  readonly system: Partial<SystemSource>;
  /**
   * The origin of each fact that has one, by id; a part without one (a field, an endpoint) takes its holder's. The
   * structure (systems and components) has none.
   */
  readonly origins: Readonly<Record<string, Origin>>;
  /** The team that owns a thing today, through the system or component holding it. */
  readonly ownerTeam: (id: string) => string | null;
  readonly partners: readonly string[];
}

/** A thing in today, and whether its word counts towards realisation. */
interface Found {
  readonly node: Rec;
  readonly counts: boolean;
  readonly origin: Origin | null;
}

/** Today, by id, as realisation reads it. */
export interface TodayModel {
  readonly find: (id: string) => Found | null;
}

const rootOf = (id: string): string => rootId(id);

/**
 * Whether a fact of this origin counts: one read from code or written by people does; the demo seed does not; a
 * document does only when it is the owning partner team's own word. Structure without an origin is written by
 * people.
 */
export function hasAuthority(
  origin: Origin | null,
  owner: string | null,
  partners: readonly string[],
): boolean {
  switch (origin) {
    case null:
    case 'extracted':
    case 'curated': {
      return true;
    }
    case 'documented': {
      return owner !== null && partners.includes(owner);
    }
    case 'seeded': {
      return false;
    }
  }
}

/** Today indexed by id (named parts too), with each fact's authority. */
export function todayModelOf(facts: TodayFacts): TodayModel {
  const { idx } = indexSystem(systemOf(facts.system));
  return {
    find: (id) => {
      const entry = idx.get(id);
      if (entry === undefined) return null;
      const holder = entry.parent ?? rootOf(id);
      const origin = facts.origins[id] ?? facts.origins[holder] ?? null;
      const owner = facts.ownerTeam(id) ?? facts.ownerTeam(holder);
      return { node: entry.entity, counts: hasAuthority(origin, owner, facts.partners), origin };
    },
  };
}

type Judged = Omit<OpRealisation, 'op'>;

/** The id an add op gives what it adds: its own id, or `<schema>#<name>` for a field. */
function addedIdOf(op: OpAdd): string | null {
  if (op.add === 'field') return fieldId(op.into, op.value.name);
  const id = prop(op.value, 'id');
  return typeof id === 'string' ? id : null;
}

const unsaid = (found: Found): string =>
  `today has it only from a ${found.origin ?? 'unknown'} source, which does not make it so`;

/** The one property an added endpoint or message must agree on, beyond its id. */
function keyOf(op: OpAdd): readonly [string, unknown] | null {
  if (op.add === 'endpoint') return ['sig', op.value.sig];
  return op.add === 'message' ? ['topic', op.value.topic] : null;
}

function realiseAdd(op: OpAdd, today: TodayModel): Judged {
  const target = addedIdOf(op);
  if (target === null) {
    return { target, state: 'missing', detail: 'the op adds nothing with an id' };
  }
  const found = today.find(target);
  if (found === null) return { target, state: 'missing', detail: `today has no ${target}` };
  if (!found.counts) return { target, state: 'missing', detail: unsaid(found) };
  const key = keyOf(op);
  const said = key === null ? undefined : found.node[key[0]];
  if (key !== null && canonical(said) !== canonical(key[1])) {
    return {
      target,
      state: 'differs',
      detail: `today's ${key[0]} is ${canonical(said)}; the plan's is ${canonical(key[1])}`,
    };
  }
  return { target, state: 'matches', detail: `today has ${target}` };
}

const listIn = (node: Rec, key: string): readonly string[] => {
  const value = node[key];
  return Array.isArray(value) ? value.map(canonical) : [];
};

/** Each thing a modify op says, true where today says it too. */
function modifyChecks(op: OpModify, node: Rec): readonly boolean[] {
  const set = Object.entries(op.set ?? {}).map(
    ([key, value]) => canonical(node[key]) === canonical(value),
  );
  const appended = Object.entries(op.append ?? {}).flatMap(([key, values]) =>
    values.map((value) => listIn(node, key).includes(canonical(value))),
  );
  const dropped = Object.entries(op.drop ?? {}).flatMap(([key, values]) =>
    values.map((value) => !listIn(node, key).includes(canonical(value))),
  );
  return [...set, ...appended, ...dropped];
}

function realiseModify(op: OpModify, today: TodayModel): Judged {
  const target = op.modify;
  const found = today.find(target);
  if (found === null) return { target, state: 'missing', detail: `today has no ${target}` };
  if (!found.counts) return { target, state: 'missing', detail: unsaid(found) };
  const checks = modifyChecks(op, found.node);
  const held = checks.filter(Boolean).length;
  const of = `${String(held)} of ${String(checks.length)}`;
  if (held === checks.length) return { target, state: 'matches', detail: `today says all ${of}` };
  return held === 0
    ? { target, state: 'missing', detail: `today says none of the ${String(checks.length)}` }
    : { target, state: 'partial', detail: `today says ${of}` };
}

const isDeprecated = (node: Rec): boolean =>
  node.deprecated === true || node.status === 'deprecated';

function realiseGone(target: string, today: TodayModel, deprecate: boolean): Judged {
  const found = today.find(target);
  if (found?.counts !== true) {
    return { target, state: 'matches', detail: `today has no ${target}` };
  }
  if (deprecate && isDeprecated(found.node)) {
    return { target, state: 'matches', detail: `today marks ${target} deprecated` };
  }
  return { target, state: 'missing', detail: `today still has ${target}` };
}

/** One op compared with today. */
export function realiseOp(op: Op, today: TodayModel): Judged {
  if ('add' in op) return realiseAdd(op, today);
  if ('modify' in op) return realiseModify(op, today);
  if ('deprecate' in op) return realiseGone(op.deprecate, today, true);
  return realiseGone(op.remove, today, false);
}

/**
 * The state of a change from its ops: matches when all match, missing when all are missing (or it has no ops
 * yet), differs when any differs, partial otherwise.
 */
export function rollUp(states: readonly RealisationState[]): RealisationState {
  if (states.every((state) => state === 'missing')) return 'missing';
  if (states.every((state) => state === 'matches')) return 'matches';
  return states.includes('differs') ? 'differs' : 'partial';
}

/** A change compared with today, op by op. */
export function realiseChange(change: Change, today: TodayModel): ChangeRealisation {
  const ops = (change.ops ?? []).map((op, i) => ({ op: i, ...realiseOp(op, today) }));
  return { change: change.id, state: rollUp(ops.map((op) => op.state)), ops };
}

/** Every change of a plan compared with today. */
export function realisationOf(plan: Pick<Plan, 'changes'>, today: TodayModel): ChangeRealisation[] {
  return (plan.changes ?? []).map((change) => realiseChange(change, today));
}

/** The origin of each attributed fact, by id. */
export function originsOf(
  attribution: Readonly<Record<string, { readonly origin: Origin }>>,
): Readonly<Record<string, Origin>> {
  return Object.fromEntries(Object.entries(attribution).map(([id, said]) => [id, said.origin]));
}
