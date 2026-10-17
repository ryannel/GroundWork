import type { Core, Indexed } from '@/application/plan/derive-core';
import type { Register } from '@/application/plan/derive-register';
import { dayOf, isoDay, memo, textOf, tie } from '@/application/plan/derive-values';
import { prop, strings, typeOf } from '@/application/plan/ids';
import type { IssueStatus } from '@/domain/plan/plan-status';
import { SIZE_WEIGHT } from '@/domain/plan/plan-vocab';
import type { Question, WorkItem } from '@/domain/plan/plan.generated';

const LAST = '\uFFFF';
const FAR = 1e9;

export interface CriticalPath {
  readonly path: readonly string[];
  readonly weight: number;
}

export interface MilestoneViolation {
  readonly workItem: string;
  readonly dependsOn: string;
  readonly milestone: string | undefined;
  readonly dependsOnMilestone: string | undefined;
}

export interface IssueState {
  readonly state: string;
  readonly closed_at: string | null;
  readonly url: string | null;
}

export interface Delivery {
  readonly topoOrder: () => string[];
  readonly criticalPath: () => CriticalPath;
  readonly waves: () => string[][];
  readonly milestoneViolations: () => MilestoneViolation[];
  readonly blockersOf: (id: string) => string[];
  readonly overdue: (
    q: string | Pick<Question, 'decide_by' | 'status'>,
    on?: Date | string,
  ) => boolean;
  readonly statusOf: (wiId: string) => IssueState | null;
  readonly milestoneProgress: (msId: string) => { readonly done: number; readonly total: number };
  readonly wiById: ReadonlyMap<string, WorkItem>;
  readonly questions: readonly Indexed[];
  /** The day the model was derived for; undefined when the caller gave none. */
  readonly today: Date | undefined;
}

interface Work {
  readonly core: Core;
  readonly wiById: ReadonlyMap<string, WorkItem>;
  readonly msIndex: ReadonlyMap<string, number>;
  readonly msRank: (id: string | undefined) => number;
  readonly depsOf: (id: string) => string[];
  readonly before: (a: string, b: string) => number;
}

function workOf(core: Core): Work {
  const wiById = new Map(core.workItems.map((w) => [w.id, w]));
  const msIndex = new Map(core.milestones.map((m, i) => [m.id, i]));
  const msRank = (id: string | undefined): number => msIndex.get(id ?? '') ?? FAR;
  const msDue = (id: string): string =>
    core.milestones.find((m) => m.id === wiById.get(id)?.milestone)?.due ?? LAST;
  return {
    core,
    wiById,
    msIndex,
    msRank,
    depsOf: (id) => (wiById.get(id)?.depends_on ?? []).filter((d) => wiById.has(d)),
    before: (a, b) =>
      tie(
        msDue(a).localeCompare(msDue(b)),
        msRank(wiById.get(a)?.milestone) - msRank(wiById.get(b)?.milestone),
        a.localeCompare(b),
      ),
  };
}

/** Work items in dependency order (deps first), ties by milestone then authored order. */
function topoOrderOf({ core, msRank, depsOf }: Work): string[] {
  const order: string[] = [];
  const done = new Set<string>();
  const pending = core.workItems.toSorted((a, b) =>
    tie(
      msRank(a.milestone) - msRank(b.milestone),
      core.workItems.indexOf(a) - core.workItems.indexOf(b),
    ),
  );
  while (pending.length > 0) {
    const i = pending.findIndex((w) => depsOf(w.id).every((d) => done.has(d)));
    const next = i === -1 ? undefined : pending.splice(i, 1)[0];
    if (next === undefined) break;
    order.push(next.id);
    done.add(next.id);
  }
  return [...order, ...pending.map((w) => w.id)]; // cycle members (invalid plans) go last
}

/** For each item, the weight of the heaviest chain ending in it and the dependency that chain came through. */
function chains(work: Work, order: readonly string[]) {
  const best = new Map<string, number>();
  const prev = new Map<string, string | null>();
  for (const id of order) {
    let top = 0;
    let from: string | null = null;
    for (const d of work.depsOf(id)) {
      const v = best.get(d) ?? -1;
      if (v > top || (v === top && from !== null && work.before(d, from) < 0)) {
        top = v;
        from = d;
      }
    }
    best.set(id, top + SIZE_WEIGHT[work.wiById.get(id)?.size ?? 'M']);
    prev.set(id, from);
  }
  return { best, prev };
}

/** The item ending the heaviest chain; on a tie, the one that comes first by due date. */
function heaviest(work: Work, best: ReadonlyMap<string, number>): string | null {
  let end: string | null = null;
  for (const [id, v] of best) {
    const endValue = end === null ? 0 : (best.get(end) ?? 0);
    if (end === null || v > endValue || (v === endValue && work.before(id, end) < 0)) end = id;
  }
  return end;
}

/**
 * The heaviest chain of work items by size. A tie is broken on purpose, never by plan order: the item whose
 * milestone is due first (then the earlier milestone), then the lower id.
 */
function criticalPathOf(work: Work, order: readonly string[]): CriticalPath {
  const { best, prev } = chains(work, order);
  const end = heaviest(work, best);
  const path: string[] = [];
  let cur = end;
  for (let guard = 0; cur !== null && guard <= work.core.workItems.length; guard++) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return { path, weight: end === null ? 0 : (best.get(end) ?? 0) };
}

/**
 * Work items grouped into build waves: an item's wave is one after its latest dependency. Items in the same
 * wave do not depend on each other, so a single-item wave is sequential and a larger one runs in parallel.
 */
function wavesOf({ depsOf }: Work, order: readonly string[]): string[][] {
  const level = new Map<string, number>();
  const out: string[][] = [];
  for (const id of order) {
    const n = Math.max(-1, ...depsOf(id).map((d) => level.get(d) ?? -1)) + 1;
    level.set(id, n);
    const wave = out[n] ?? [];
    wave.push(id);
    out[n] = wave;
  }
  return out.filter(Boolean);
}

/** Work items depending on a work item in a later milestone. */
function violationsOf({ core, wiById, msIndex, msRank, depsOf }: Work): MilestoneViolation[] {
  return core.workItems.flatMap((w) =>
    depsOf(w.id)
      .filter((d) => {
        const dep = wiById.get(d);
        return (
          msIndex.has(w.milestone ?? '') &&
          msIndex.has(dep?.milestone ?? '') &&
          msRank(dep?.milestone) > msRank(w.milestone)
        );
      })
      .map((d) => ({
        workItem: w.id,
        dependsOn: d,
        milestone: w.milestone,
        dependsOnMilestone: wiById.get(d)?.milestone,
      })),
  );
}

/** Everything a work item waits on: itself, the changes it implements, and every op target of those changes. */
function blockScopeOf({ core, wiById }: Work, wiId: string): Set<string> {
  const wi = wiById.get(wiId);
  if (wi === undefined) return new Set();
  const out = new Set([wiId, ...wi.implements]);
  for (const r of core.records) {
    if (r.changeId === undefined || !wi.implements.includes(r.changeId)) continue;
    if (r.target !== null) out.add(r.target);
    if (typeof r.parent === 'string') out.add(r.parent);
  }
  return out;
}

const decideBy = (e: Indexed): string => textOf(prop(e, 'decide_by')) ?? LAST;

interface Gates {
  readonly scopeOf: (id: string) => Set<string> | null;
  readonly questions: readonly Indexed[];
  readonly register: Register;
}

/**
 * The gates a work item waits on: open questions blocking it (via `blocks` on the item, a change it implements,
 * or any entity those changes' ops target) and proposed decisions its changes rest on or that answer one of
 * those questions; for a milestone, the union over its items. Ordered by decide_by (undated last), then plan order.
 */
function blockersOf({ core, ...rest }: Gates & { readonly core: Core }, id: string): string[] {
  const scope = rest.scopeOf(id);
  if (scope === null) return [];
  const { register } = rest;
  const qs = rest.questions.filter(
    (q) => prop(q, 'status') !== 'resolved' && strings(prop(q, 'blocks')).some((b) => scope.has(b)),
  );
  const blocking = new Set(qs.map((q) => q.id));
  // a proposed decision is a gate too: one the item's changes rest on, or one that answers a blocking question
  const gates = (d: Indexed): boolean =>
    register.weightOf(d.id).ids.some((x) => scope.has(x)) ||
    register.answersOf(d.id).some((q) => blocking.has(q.id));
  const decs = [...core.planIndex.values()].filter(
    (d) =>
      d.$type === 'decision' &&
      (textOf(prop(d, 'status')) ?? 'proposed') === 'proposed' &&
      gates(d),
  );
  // a question a listed decision answers reads as part of it (the register folds it the same way)
  const order = [...qs.filter((q) => !decs.some((d) => d.id === prop(q, 'answered_by'))), ...decs];
  return order
    .toSorted((a, b) =>
      tie(decideBy(a).localeCompare(decideBy(b)), order.indexOf(a) - order.indexOf(b)),
    )
    .map((q) => q.id);
}

/** What a work item waits on, or for a milestone the union over its items. */
function scopeFor(core: Core, blockScope: (wiId: string) => Set<string>, id: string) {
  const type = typeOf(id);
  if (type === 'workItem') return blockScope(id);
  if (type !== 'milestone') return null;
  const members = core.workItems.filter((x) => x.milestone === id);
  return new Set([id, ...members.flatMap((w) => [...blockScope(w.id)])]);
}

/** GitHub issue state for a work item from the status map, else null. */
function statusFrom(issueStatus: IssueStatus, wiId: string): IssueState | null {
  const s = issueStatus[wiId];
  return s
    ? {
        state: s.state === 'closed' ? 'closed' : 'open',
        closed_at: s.closed_at ?? null,
        url: s.url ?? null,
      }
    : null;
}

/** What delivery reads beyond the plan: the issue state of each work item, and the day it is. */
export interface DeliveryInput {
  readonly status: IssueStatus;
  readonly today?: Date | string | undefined;
}

/** Work items, milestones and the questions and decisions that hold them up. */
export function createDelivery(core: Core, register: Register, input: DeliveryInput): Delivery {
  const { status: issueStatus, today } = input;
  const work = workOf(core);
  const { wiById } = work;
  const topoOrder = memo((): string[] => topoOrderOf(work));
  const criticalPath = memo(() => criticalPathOf(work, topoOrder()));
  const waves = memo((): string[][] => wavesOf(work, topoOrder()));
  const milestoneViolations = memo(() => violationsOf(work));

  const questions: Indexed[] = (core.plan.questions ?? []).flatMap(
    (q) => core.planIndex.get(q.id) ?? [],
  );
  const qById = new Map(questions.map((q) => [q.id, q]));
  const blockScope = memo((wiId: string): Set<string> => blockScopeOf(work, wiId));
  const scopeOf = (id: string): Set<string> | null => scopeFor(core, blockScope, id);
  const blockers = memo((id: string): string[] =>
    blockersOf({ core, scopeOf, questions, register }, id),
  );

  /**
   * An open question whose decide_by is before `on` (a Date or YYYY-MM-DD; the model's today when left out, and
   * never overdue when neither is known). Accepts a question or its id.
   */
  const overdue = (
    q: string | Pick<Question, 'decide_by' | 'status'>,
    on: Date | string | undefined = today,
  ): boolean => {
    const qq = typeof q === 'string' ? qById.get(q) : q;
    const due = textOf(prop(qq, 'decide_by'));
    if (on === undefined || due === undefined || due === '') return false;
    if (prop(qq, 'status') === 'resolved') return false;
    return isoDay(due).localeCompare(isoDay(on)) < 0;
  };

  const statusOf = (wiId: string): IssueState | null => statusFrom(issueStatus, wiId);

  /** Closed vs total work items in a milestone. */
  const milestoneProgress = memo((msId: string) => {
    const items = core.workItems.filter((w) => w.milestone === msId);
    return {
      done: items.filter((w) => statusOf(w.id)?.state === 'closed').length,
      total: items.length,
    };
  });

  return {
    topoOrder,
    criticalPath,
    waves,
    milestoneViolations,
    blockersOf: blockers,
    overdue,
    statusOf,
    milestoneProgress,
    wiById,
    questions,
    today: dayOf(today),
  };
}
