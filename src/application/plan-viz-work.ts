import { EFFECT } from '@/application/plan/delivery';
import type { Model } from '@/application/plan/derive';
import { teamIndex } from '@/application/plan-viz-teams';
import type { Milestone, WorkItem } from '@/domain/plan/plan.generated';

// A work item, read once for every surface: where it stands, what it waits on, what depends on it.

export type WorkState = 'done' | 'open' | 'not-started';

/** The words and glyphs for a work item's state. Done reads in a quieter colour, never as opacity. */
export const STATE_WORD: Readonly<Record<WorkState, string>> = {
  done: 'done',
  open: 'open',
  'not-started': 'not started',
};
export const STATE_GLYPH: Readonly<Record<WorkState, string>> = {
  done: '✓',
  open: '◐',
  'not-started': '○',
};
export const SIZE_WORD: Readonly<Record<string, string>> = {
  XS: 'extra small',
  S: 'small',
  M: 'medium',
  L: 'large',
  XL: 'extra large',
};

export const workList = (model: Model): readonly WorkItem[] => model.plan.work_items ?? [];
export const workById = (model: Model, id: string): WorkItem | undefined =>
  workList(model).find((w) => w.id === id);
export const milestoneById = (model: Model, id?: string): Milestone | undefined =>
  (model.plan.milestones ?? []).find((m) => m.id === id);

/** Work items in build order, dependencies first. */
export function workOrdered(model: Model, keep: (w: WorkItem) => boolean = () => true): WorkItem[] {
  const order = model.topoOrder();
  const rank = (id: string): number => {
    const at = order.indexOf(id);
    return at === -1 ? order.length : at;
  };
  return workList(model)
    .filter(keep)
    .toSorted((a, b) => rank(a.id) - rank(b.id));
}

/**
 * Where a work item stands: done, open, or not started; null before delivery, while no work item in the plan has a
 * GitHub issue. Not started means no issue once delivery has begun.
 */
export function wiState(model: Model, id: string): WorkState | null {
  const work = workList(model);
  if (!work.some((w) => w.github_issue !== undefined)) return null;
  const w = work.find((x) => x.id === id);
  if (w === undefined) return null;
  if (w.github_issue === undefined) return 'not-started';
  return model.statusOf(id)?.state === 'closed' ? 'done' : 'open';
}

/** "#41", or '' when no issue is filed yet. */
export const issueNumber = (w: WorkItem): string =>
  w.github_issue === undefined ? '' : `#${String(w.github_issue)}`;

const REPO = /^[\w.-]+\/[\w.-]+$/;

/** The work item's GitHub issue: the status file's link, else built from the repo and number. */
export function issueUrl(model: Model, w: WorkItem): string | null {
  const url = model.statusOf(w.id)?.url;
  if (url !== undefined && url !== null) return url;
  if (w.github_issue === undefined || w.repo === undefined || !REPO.test(w.repo)) return null;
  return `https://github.com/${w.repo}/issues/${String(w.github_issue)}`;
}

/** Work items on the critical path. */
export const criticalSet = (model: Model): ReadonlySet<string> =>
  new Set(model.criticalPath().path);

/** The rest of a milestone's name after "M1 ·". */
export const msTitle = (ms: Milestone | undefined): string =>
  (ms?.name ?? '').split(' · ').slice(1).join(' · ');

/** The work items that need this one, in build order. */
export const dependentsOf = (model: Model, id: string): WorkItem[] =>
  workOrdered(model, (w) => (w.depends_on ?? []).includes(id));

/** The fields of a card as one plain string: "done|#41|S|M1|critical". */
export function workFacts(model: Model, w: WorkItem, shortName: (ms: Milestone) => string): string {
  const state = wiState(model, w.id);
  const ms = milestoneById(model, w.milestone);
  return [
    state ?? '',
    state === null ? '' : issueNumber(w),
    w.size ?? '',
    ms === undefined ? '' : shortName(ms),
    criticalSet(model).has(w.id) ? 'critical' : '',
  ].join('|');
}

export const teamSlot = (model: Model, w: WorkItem): number => teamIndex(model, w.team);

/** Teams in lane order, each once. */
export const orderTeams = (model: Model, teamIds: readonly string[]): string[] =>
  [...new Set(teamIds)].toSorted((a, b) => teamIndex(model, a) - teamIndex(model, b));

/** A proposal's effect on one work item: what a card tags ("reopened in 1.2"). */
export interface RevisionTag {
  readonly version: string | null;
  readonly effect: keyof typeof EFFECT;
  readonly authored: boolean;
  readonly note: string | null;
  /** 0 live, 1 approved, 2 rejected. */
  readonly when?: 0 | 1 | 2;
}

const TAGGED = new Set(['rework', 'changes', 'new', 'drop']);

/** The neutral tag a proposal puts on a work item, and why. */
export function revisionTag(rev: RevisionTag): { text: string; why: string; pending: boolean } {
  const when = rev.when ?? 0;
  const word = EFFECT[rev.effect][when];
  const pending = rev.effect === 'new' && when === 0;
  const version = rev.version ?? 'the proposal';
  let why = 'Inferred from the changes it builds';
  if (rev.authored)
    why = rev.note === null ? 'The proposal says so' : `The proposal says so: ${rev.note}`;
  if (pending)
    why = `Only in the proposed ${version}: not counted in delivery until it is approved`;
  if (!TAGGED.has(rev.effect)) return { text: word, why, pending };
  return { text: `${word} in ${version}${pending ? ' · not approved' : ''}`, why, pending };
}
