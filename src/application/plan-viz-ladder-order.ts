import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';

// When each rung of a migration ladder is planned, and what is out of order: a consumer that switches before the
// new version exists, or an old version removed before its last consumer has moved.

export type Ladder = ReturnType<Model['ladder']>;
type Rung = Ladder['rungs'][number];

export const isConsumer = (id: string | undefined): id is string => id?.startsWith('svc:') === true;

const milestoneOrder = (model: Model): string[] => (model.plan.milestones ?? []).map((m) => m.id);

const text = (x: unknown): string => (typeof x === 'string' ? x : '');

/** "M2 · Migrate consumers" is "M2". */
export function msShort(model: Model, msId: string): string {
  const name = model.get(msId) === undefined ? msId : model.label(msId);
  return name.split(' · ')[0] ?? name;
}

const milestoneOf = (model: Model, wi: string): string | null =>
  model.plan.work_items?.find((w) => w.id === wi)?.milestone ?? null;

/** The latest milestone among work items: a rung is done when its last work item is. */
export function rungMilestone(model: Model, wis: readonly string[]): string | null {
  const order = milestoneOrder(model);
  let best: string | null = null;
  for (const w of wis) {
    const ms = milestoneOf(model, w);
    if (ms !== null && (best === null || order.indexOf(ms) > order.indexOf(best))) best = ms;
  }
  return best;
}

/** True when milestone `a` comes before `b` in the plan's order. */
export function msBefore(model: Model, a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const order = milestoneOrder(model);
  return order.indexOf(a) < order.indexOf(b);
}

/** The last milestone a consumer migrates in, or null. */
export function lastMigrateMs(model: Model, l: Pick<Ladder, 'rungs'>): string | null {
  return (
    l.rungs
      .filter((r) => r.rung === 'migrate')
      .map((r) => rungMilestone(model, r.workItems))
      .filter((m) => m !== null)
      .toSorted((a, b) => milestoneOrder(model).indexOf(b) - milestoneOrder(model).indexOf(a))[0] ??
    null
  );
}

export interface Retirement {
  readonly ms: string | null;
  /** The retiring work is planned before the last migration. */
  readonly early: boolean;
  readonly lastMigrate: string | null;
  readonly changes: readonly string[];
  readonly kind: 'retire' | 'deprecate' | null;
}

const NONE: Retirement = { ms: null, early: false, lastMigrate: null, changes: [], kind: null };

function retireKind(l: Ladder): Retirement['kind'] {
  if (l.retired || l.rungs.some((r) => r.kind === 'retire')) return 'retire';
  return l.rungs.some((r) => r.kind === 'deprecate') ? 'deprecate' : null;
}

/**
 * When the old version retires: the milestone of the work implementing the change that holds the deprecate (or
 * remove) op on an old version in the chain. Only a remove retires; a deprecate keeps the old version served.
 */
export function retireMilestone(model: Model, id: string): Retirement {
  const l = model.ladder(id);
  if (l.chain.length === 0) return NONE;
  const kind = retireKind(l);
  const old = new Set(l.chain.slice(0, -1));
  const key = kind === 'retire' ? 'remove' : 'deprecate';
  const changes =
    kind === null
      ? []
      : (model.plan.changes ?? [])
          .filter((c) => c.ops.some((o) => old.has(text(prop(o, key)))))
          .map((c) => c.id);
  const wis = (model.plan.work_items ?? [])
    .filter((w) => w.implements.some((c) => changes.includes(c)))
    .map((w) => w.id);
  const own = l.rungs.find((r) => r.kind === kind)?.workItems ?? [];
  const ms = rungMilestone(model, wis) ?? (kind === null ? null : rungMilestone(model, own));
  const lastMigrate = lastMigrateMs(model, l);
  const early = kind === 'retire' && msBefore(model, ms, lastMigrate);
  return { ms, early, lastMigrate, changes, kind };
}

/** "a, b and c". */
export function andList(xs: readonly string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1) ?? ''}`;
}

/** As-is messages and endpoints this plan deprecates, removes or replaces: the contracts that version or retire. */
function contractIds(model: Model): string[] {
  return [...model.asIs.messages, ...model.asIs.endpoints]
    .map((x) => x.id)
    .filter((id) => {
      const status = model.status(id);
      return (
        status === 'deprecated' || status === 'removed' || model.versions(id).replacedBy !== null
      );
    });
}

const climbs = (model: Model, id: string): boolean => {
  const l = model.ladder(id);
  return l.rungs.length > 0 && l.chain[0] === id;
};

/** Ids that climb a migration ladder: versioned contracts (first of their chain) and graph fields that move subgraphs. */
export function ladderIds(model: Model): string[] {
  const out = contractIds(model).filter((id) => climbs(model, id));
  const graph = model.toBe.graphs[0];
  const fields = graph === undefined ? [] : model.graphDiff(graph.id).fields;
  for (const f of fields) {
    if ((f.moved || f.override) && climbs(model, f.id) && !out.includes(f.id)) out.push(f.id);
  }
  return out;
}

export interface SequenceNote {
  readonly wi: string;
  readonly text: string;
}

export interface Sequencing {
  readonly id: string;
  readonly sentences: readonly string[];
  readonly notes: readonly SequenceNote[];
}

interface Early {
  readonly consumer: string;
  readonly ms: string | null;
  readonly items: readonly string[];
}

const consumerMoves = (model: Model, l: Ladder): Early[] =>
  l.rungs
    .filter((r) => r.rung === 'migrate' && isConsumer(r.consumer))
    .map((r) => ({
      consumer: r.consumer ?? '',
      ms: rungMilestone(model, r.workItems),
      items: r.workItems,
    }));

interface Names {
  readonly old: string;
  readonly next: string;
  readonly named: boolean;
}

/** The two ends of a chain as words: a pair with one name collapses to its versions ("v1", "v2"). */
export function versionNames(
  model: Model,
  from: string,
  to: string,
): Names & { readonly name: string | null } {
  const [a, b] = [model.get(from), model.get(to)];
  const na = prop(a, 'name');
  const va = prop(a, 'version');
  const vb = prop(b, 'version');
  if (
    typeof na === 'string' &&
    na === prop(b, 'name') &&
    typeof va === 'string' &&
    typeof vb === 'string'
  ) {
    return { old: va, next: vb, named: true, name: na };
  }
  return { old: model.label(from), next: model.label(to), named: false, name: null };
}

interface Order {
  readonly model: Model;
  readonly n: Names;
  readonly expand: Rung | undefined;
  readonly expandMs: string | null;
}

interface Part {
  readonly sentence: string;
  readonly notes: readonly SequenceNote[];
}

const shortMs = (model: Model, m: string | null): string => (m === null ? '' : msShort(model, m));

/** Consumers planned to switch in a milestone before the new version exists. */
function earlyPart(o: Order, early: readonly Early[]): Part {
  const { model, n, expand, expandMs } = o;
  const lab = (c: string) => model.label(c);
  const to = n.named ? n.next : `\`${n.next}\``;
  const names = andList(early.map((e) => lab(e.consumer)));
  const are = early.length === 1 ? 'is' : 'are';
  const when = [...new Set(early.map((e) => shortMs(model, e.ms)))];
  const only = when.length === 1 ? when[0] : undefined;
  const sentence =
    only === undefined
      ? `${names} are planned to switch to ${to} before ${to} exists (${shortMs(model, expandMs)}).`
      : `${names} ${are} planned to switch to ${to} in ${only}, a milestone before ${to} exists.`;
  const switches = early.flatMap((e) =>
    e.items.map((wi) => ({
      wi,
      text: `Switches ${lab(e.consumer)} to ${n.next} in ${shortMs(model, e.ms)}, a milestone before ${n.named ? n.next : 'it'} exists (${shortMs(model, expandMs)})`,
    })),
  );
  const publishes = (expand?.workItems ?? [])
    .filter((x) => milestoneOf(model, x) === expandMs)
    .map((wi) => ({
      wi,
      text: `Publishes ${n.next} in ${shortMs(model, expandMs)}, after ${names} ${are} planned to switch (${andList(when)})`,
    }));
  return { sentence, notes: [...switches, ...publishes] };
}

/** The old version planned to go before the last consumer has moved. */
function retirePart(o: Order, id: string, l: Ladder): Part | null {
  const { model, n } = o;
  const retirement = retireMilestone(model, id);
  const { ms, lastMigrate } = retirement;
  if (!retirement.early || ms === null || lastMigrate === null) return null;
  const last = consumerMoves(model, l).filter((r) => r.ms === lastMigrate);
  const names = andList(last.map((r) => model.label(r.consumer)));
  const items = (model.plan.work_items ?? [])
    .filter((w) => w.implements.some((c) => retirement.changes.includes(c)) && w.milestone === ms)
    .map((w) => w.id);
  const consumerItems = [
    ...new Set(last.flatMap((r) => r.items.filter((w) => milestoneOf(model, w) === lastMigrate))),
  ];
  const who = n.named ? n.old : `\`${n.old}\``;
  const them = names === '' ? 'the last consumer' : names;
  const [at, then] = [msShort(model, ms), msShort(model, lastMigrate)];
  const notes = [
    ...items.map((wi) => ({ wi, text: `Removes ${who} in ${at}, before ${them} moves (${then})` })),
    ...consumerItems.map((wi) => ({
      wi,
      text: `Moves ${names} in ${then}, after ${who} is planned to go (${at})`,
    })),
  ];
  return {
    sentence: `${who} is planned to be removed in ${at}, before ${them} ${last.length > 1 ? 'have' : 'has'} moved (${then}).`,
    notes,
  };
}

/**
 * What is out of order on one ladder, said in the plan's words, or null when the ladder is in order. Two faults,
 * both read from the work items' milestones: a consumer switching before the new version exists, and the old
 * version going before the last consumer has moved.
 */
export function sequencing(model: Model, id: string): Sequencing | null {
  const l = model.ladder(id);
  const from = l.chain[0];
  const to = l.chain.at(-1);
  if (from === undefined || to === undefined || from === to || l.rungs.length === 0) return null;
  const n = versionNames(model, from, to);
  const expand = l.rungs.find((r) => r.rung === 'expand');
  const o: Order = {
    model,
    n,
    expand,
    expandMs: expand === undefined ? null : rungMilestone(model, expand.workItems),
  };
  const early = consumerMoves(model, l).filter((r) => msBefore(model, r.ms, o.expandMs));
  const parts = [early.length === 0 ? null : earlyPart(o, early), retirePart(o, id, l)].filter(
    (p) => p !== null,
  );
  if (parts.length === 0) return null;
  return { id, sentences: parts.map((p) => p.sentence), notes: parts.flatMap((p) => p.notes) };
}

/** Every work item that sits on a sequencing problem, with what is wrong: work item id to its notes. */
export function sequenceNotes(model: Model): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of ladderIds(model)) {
    for (const n of sequencing(model, id)?.notes ?? []) {
      const have = out.get(n.wi) ?? [];
      if (!have.includes(n.text)) out.set(n.wi, [...have, n.text]);
    }
  }
  return out;
}
