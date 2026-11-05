import type { TeamVM, WorkCardVM } from './work-card';
import {
  type IndexedWork,
  isHeldUp,
  workDone,
  type WorkspacePlanIndex,
} from './workspace-plan-index';

// The work still to do that touches one team or one system, across every plan, in the order it can happen: what can
// start now, what is next once that is done, what comes then, and what is held up.

export interface SystemVM {
  readonly id: string;
  readonly name: string;
}

export type ImpactState = 'now' | 'next' | 'then' | 'blocked';

export interface ImpactVM {
  readonly subject: ({ readonly kind: 'team' } & TeamVM) | ({ readonly kind: 'system' } & SystemVM);
  /** Only the groups with work in them, in the order now, next, then, blocked. */
  readonly groups: readonly {
    readonly state: ImpactState;
    readonly items: readonly WorkCardVM[];
  }[];
}

export type ImpactSubject =
  | { readonly kind: 'team'; readonly id: string }
  | { readonly kind: 'system'; readonly id: string; readonly name: string };

const STATES: readonly ImpactState[] = ['now', 'next', 'then', 'blocked'];

/** How many waves of unfinished work stand before each item: 0 can start now. A circle counts once. */
function depthsOf(index: WorkspacePlanIndex): (key: string) => number {
  const depths = new Map<string, number>();
  const depth = (key: string, seen: ReadonlySet<string>): number => {
    const known = depths.get(key);
    if (known !== undefined) return known;
    const work = index.work.get(key);
    if (work === undefined || workDone(work) || seen.has(key)) return -1;
    const before = work.dependsOn.map((dep) => depth(dep, new Set([...seen, key])));
    const found = Math.max(-1, ...before) + 1;
    depths.set(key, found);
    return found;
  };
  return (key) => depth(key, new Set());
}

function stateOf(work: IndexedWork, depth: number): ImpactState {
  if (isHeldUp(work)) return 'blocked';
  if (depth <= 0) return 'now';
  return depth === 1 ? 'next' : 'then';
}

function touches(index: WorkspacePlanIndex, work: IndexedWork, subject: ImpactSubject): boolean {
  if (subject.kind === 'team') return work.standing.team.id === subject.id;
  return work.implements.some(
    (key) => index.changes.get(key)?.systems.includes(subject.id) === true,
  );
}

function subjectVM(index: WorkspacePlanIndex, subject: ImpactSubject): ImpactVM['subject'] | null {
  if (subject.kind === 'system') return { kind: 'system', id: subject.id, name: subject.name };
  const team = index.teams.get(subject.id);
  return team === undefined
    ? null
    : { kind: 'team', id: team.id, name: team.name, partner: team.partner };
}

/** The pending work on a team or a system across every plan; null for a team the workspace does not have. */
export function impactVM(index: WorkspacePlanIndex, subject: ImpactSubject): ImpactVM | null {
  const head = subjectVM(index, subject);
  if (head === null) return null;
  const depth = depthsOf(index);
  const order = (w: IndexedWork): number => index.plans.get(w.plan)?.order ?? 0;
  const pending = [...index.work.values()]
    .filter((w) => !workDone(w) && touches(index, w, subject))
    .map((w) => ({ w, state: stateOf(w, depth(w.key)), depth: depth(w.key) }))
    .toSorted((a, b) => (a.depth === b.depth ? order(a.w) - order(b.w) : a.depth - b.depth));
  const groups = STATES.map((state) => ({
    state,
    items: pending.filter((p) => p.state === state).map((p) => p.w.card),
  })).filter((group) => group.items.length > 0);
  return { subject: head, groups };
}

/** One row of pending work on a system's page: who owns it, what it is, the plan it is in and how it stands. */
export interface ImpactRowVM {
  readonly key: string;
  /** "Orders owns", or "Ziklo owns · we depend on this" for a partner. */
  readonly owner: string;
  readonly partner: boolean;
  readonly title: string;
  readonly href: string;
  readonly plan: { readonly title: string; readonly href: string };
  /** "in progress", "commitment accepted", "not started". */
  readonly state: string;
  /** What holds it up, when it is in the blocked group. */
  readonly reason: string | null;
}

/** Who owns a piece of work, in plain words: the team by name, and for a partner that we depend on it. */
export const ownerWords = (team: TeamVM): string =>
  team.partner ? `${team.name} owns · we depend on this` : `${team.name} owns`;

function stateWords(card: WorkCardVM): string {
  if (card.progress !== null) return card.progress.state;
  return card.commitment === null ? 'not started' : `commitment ${card.commitment.state}`;
}

export type ImpactRows = readonly {
  readonly state: ImpactState;
  readonly rows: readonly ImpactRowVM[];
}[];

/** The rows of an impact, group by group, each worded for a reader of the system's page. */
export function impactRowsOf(index: WorkspacePlanIndex, impact: ImpactVM): ImpactRows {
  return impact.groups.map((group) => ({
    state: group.state,
    rows: group.items.map((card) => {
      const plan = index.plans.get(card.plan);
      return {
        key: card.key,
        owner: ownerWords(card.team),
        partner: card.team.partner,
        title: card.title,
        href: card.href,
        plan: { title: plan?.title ?? card.plan, href: plan?.href ?? '' },
        state: stateWords(card),
        reason: group.state === 'blocked' ? (card.blockers[0]?.label ?? stateWords(card)) : null,
      };
    }),
  }));
}

/** What a group of an impact means, for its heading. */
export function impactHeading(state: ImpactState): string {
  switch (state) {
    case 'now': {
      return 'Now: nothing it waits on is still to do';
    }
    case 'next': {
      return 'Next: once the work above is done';
    }
    case 'then': {
      return 'Then: after that';
    }
    case 'blocked': {
      return 'Blocked: held up until something is settled';
    }
  }
}

/** The work still to do on one system across every plan, as rows; none when the plans could not be read. */
export function systemImpactRows(
  index: WorkspacePlanIndex | null,
  system: { readonly id: string; readonly name: string },
): ImpactRows {
  if (index === null) return [];
  const impact = impactVM(index, { kind: 'system', id: system.id, name: system.name });
  return impact === null ? [] : impactRowsOf(index, impact);
}
