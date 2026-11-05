import { gapDays } from '@/application/plan/work-standing';
import type { PlanRow } from '@/application/plan-index';
import { domainHref, programmeHref } from '@/application/workspace-paths';
import { qualifyId } from '@/domain/ids';
import { plain } from '@/shared/plain-text';

import { firstDate, type MilestoneVM, rolledUp } from './milestones';
import { gapText, type WorkCardVM } from './work-card';
import {
  type DependencyHealth,
  type IndexedPlan,
  type IndexedProgramme,
  type IndexedWork,
  isHeldUp,
  workDone,
  type WorkspacePlanIndex,
} from './workspace-plan-index';

// A programme's page: its outcome and where it stands, its plans in the order they land, its milestones with the plan
// milestones that serve them, and the partner work it depends on, each with its date gap and the plan it holds up first.

export interface ProgrammeVM {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
  readonly href: string;
}

export interface PlanLinkVM {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
}

export interface StandingVM {
  readonly plans: number;
  readonly landed: number;
  readonly blocked: number;
  /** The first plan, in landing order, whose work is held up. */
  readonly nextBlocked: PlanLinkVM | null;
  /** "2 of 5 plans landed; Sales tool is the next held up." */
  readonly text: string;
}

export interface PlanStandingVM extends PlanLinkVM {
  readonly landed: boolean;
  readonly stale: boolean;
  /** The worst health of what it builds on; ready when it builds on nothing. */
  readonly health: DependencyHealth;
  readonly buildsOn: readonly (PlanLinkVM & {
    readonly health: DependencyHealth;
    readonly through: readonly string[];
  })[];
  readonly work: { readonly total: number; readonly done: number; readonly blocked: number };
  readonly blocked: boolean;
}

export interface ProgrammeMilestoneVM extends MilestoneVM {
  /** The plan milestones that serve it. */
  readonly servedBy: readonly (PlanLinkVM & {
    readonly milestone: string;
    readonly name: string;
  })[];
}

export interface PartnerDependencyVM {
  readonly item: WorkCardVM;
  /** The first plan, in landing order, that waits on it: its own, or one that depends on it. */
  readonly blocksFirst: PlanLinkVM;
  readonly gapDays: number | null;
  readonly gapText: string | null;
}

/** A decision or a question the programme holds for its plans. */
export interface ProgrammeItemVM {
  readonly id: string;
  /** The decision's title, or the question as plain words. */
  readonly text: string;
  /** "proposed", "accepted", "open", "resolved". */
  readonly status: string;
  /** Still to settle: a proposed decision or an open question. */
  readonly open: boolean;
  readonly decideBy: string | null;
}

export interface ProgrammePageVM {
  readonly programme: ProgrammeVM;
  readonly standing: StandingVM;
  readonly plans: readonly PlanStandingVM[];
  readonly milestones: readonly ProgrammeMilestoneVM[];
  readonly decisions: readonly ProgrammeItemVM[];
  readonly questions: readonly ProgrammeItemVM[];
  readonly partnerDependencies: readonly PartnerDependencyVM[];
}

/** A programme as one row of a list: what it is for, how many plans, and the next one held up. */
export interface ProgrammeRowVM extends ProgrammeVM {
  readonly plans: number;
  readonly blocked: number;
  readonly nextBlocked: PlanLinkVM | null;
}

/** A domain the programme's plans land in, and how many of them do. */
export interface LandingVM {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly plans: number;
}

const WORST: readonly DependencyHealth[] = ['conflict', 'stale', 'waiting', 'ready'];

const worstOf = (all: readonly DependencyHealth[]): DependencyHealth =>
  WORST.find((h) => all.includes(h)) ?? 'ready';

const linkOf = (plan: IndexedPlan): PlanLinkVM => ({
  slug: plan.slug,
  title: plan.title,
  href: plan.href,
});

const stillHeldUp = (w: IndexedWork): boolean => !workDone(w) && isHeldUp(w);

function workOfPlan(index: WorkspacePlanIndex, plan: IndexedPlan): IndexedWork[] {
  return plan.work.flatMap((key) => index.work.get(key) ?? []);
}

function planStanding(index: WorkspacePlanIndex, plan: IndexedPlan): PlanStandingVM {
  const deps = index.dependencies.filter((d) => d.from === plan.slug);
  const work = workOfPlan(index, plan);
  const blocked = work.filter((w) => stillHeldUp(w)).length;
  return {
    ...linkOf(plan),
    landed: plan.landed,
    stale: plan.stale,
    health: worstOf(deps.map((d) => d.health)),
    buildsOn: deps.flatMap((d) => {
      const base = index.plans.get(d.to);
      return base === undefined ? [] : [{ ...linkOf(base), health: d.health, through: d.through }];
    }),
    work: { total: work.length, done: work.filter((w) => workDone(w)).length, blocked },
    blocked: !plan.landed && blocked > 0,
  };
}

function standingText(plans: readonly PlanStandingVM[], next: PlanLinkVM | null): string {
  const landed = plans.filter((p) => p.landed).length;
  const counted = `${String(landed)} of ${String(plans.length)} ${plans.length === 1 ? 'plan' : 'plans'} landed`;
  return next === null
    ? `${counted}; nothing is held up.`
    : `${counted}; ${next.title} is the next held up.`;
}

function milestonesOf(
  index: WorkspacePlanIndex,
  programme: string,
  plans: readonly IndexedPlan[],
): ProgrammeMilestoneVM[] {
  const milestones = index.programmes.get(programme)?.milestones ?? [];
  return milestones.map((m) => {
    const key = qualifyId(programme, m.id);
    const serving = plans.flatMap((plan) =>
      plan.standing.milestones
        .filter((s) => s.milestone.serves === key)
        .map((s) => ({ plan, standing: s })),
    );
    const promisedFor = firstDate(
      serving.map((s) => s.standing.dates.promisedFor),
      true,
    );
    const neededBy = m.due ?? null;
    const gap = gapDays(promisedFor, neededBy);
    return {
      key,
      id: m.id,
      scope: programme,
      name: m.name,
      href: programmeHref(index.workspace, programme),
      neededBy,
      promisedFor,
      gapDays: gap,
      gapText: gapText(gap),
      commitment: rolledUp(serving.map((s) => s.standing.rollup)),
      servedBy: serving.map((s) => ({
        ...linkOf(s.plan),
        milestone: s.standing.milestone.id,
        name: s.standing.milestone.name,
      })),
    };
  });
}

function partnerDependencies(
  index: WorkspacePlanIndex,
  plans: readonly IndexedPlan[],
): PartnerDependencyVM[] {
  const work = plans.flatMap((plan) => workOfPlan(index, plan));
  return work
    .filter((w) => w.standing.team.partner && !workDone(w))
    .flatMap((w) => {
      const waiting = plans.find(
        (plan) =>
          plan.slug === w.plan || workOfPlan(index, plan).some((x) => x.dependsOn.includes(w.key)),
      );
      const first = waiting;
      if (first === undefined) return [];
      return [
        {
          item: w.card,
          blocksFirst: linkOf(first),
          gapDays: w.standing.dates.gapDays,
          gapText: w.card.dates.gapText,
        },
      ];
    })
    .toSorted(
      (a, b) => (b.gapDays ?? Number.MIN_SAFE_INTEGER) - (a.gapDays ?? Number.MIN_SAFE_INTEGER),
    );
}

/** What a citation in the programme's prose is called: its decision, question or milestone, else the id. */
function labelIn(programme: IndexedProgramme): (id: string) => string {
  const names = new Map<string, string>([
    ...programme.decisions.map((d): [string, string] => [d.id, d.title]),
    ...programme.milestones.map((m): [string, string] => [m.id, m.name]),
  ]);
  return (id) => names.get(id.replace(`${programme.id}/`, '')) ?? id;
}

// A citation qualified by its plan or programme (`[[care/dec:x]]`), which the markdown reader leaves as text.
const QUALIFIED = /\[\[([\w-]+\/[^\]\s]+)\]\]/gu;

function decisionsOf(programme: IndexedProgramme): ProgrammeItemVM[] {
  return programme.decisions.map((d) => ({
    id: d.id,
    text: d.title,
    status: d.status,
    open: d.status === 'proposed',
    decideBy: d.decide_by ?? null,
  }));
}

function questionsOf(programme: IndexedProgramme): ProgrammeItemVM[] {
  const label = labelIn(programme);
  return programme.questions.map((q) => ({
    id: q.id,
    text: plain(
      q.question.replaceAll(QUALIFIED, (_, id: string) => label(id)),
      label,
    ),
    status: q.status,
    open: q.status === 'open',
    decideBy: q.decide_by ?? null,
  }));
}

/** What the health of a plan it builds on means, in words. */
export const HEALTH_WORDS: Readonly<Record<DependencyHealth, string>> = {
  ready: 'delivered',
  waiting: 'work still to do',
  stale: 'changed since checked',
  conflict: 'overlaps another plan it builds on',
};

/** How a plan stands in its programme, in words: landed, held up, changed under it, waiting, or ready. */
export function planStandingWords(plan: PlanStandingVM): string {
  if (plan.landed) return 'Landed';
  if (plan.blocked) {
    return `Held up: ${String(plan.work.blocked)} of ${String(plan.work.total)} work items blocked`;
  }
  if (plan.health === 'conflict') return 'Two plans it builds on overlap';
  if (plan.stale || plan.health === 'stale') {
    return 'A plan it builds on changed since it was checked';
  }
  if (plan.health === 'waiting') return 'Waiting for the plans it builds on';
  return plan.work.total > 0 && plan.work.done === plan.work.total ? 'Work done' : 'Ready';
}

/** Every programme as a row, by title. */
export function programmeRowsOf(index: WorkspacePlanIndex): ProgrammeRowVM[] {
  return [...index.programmes.keys()]
    .flatMap((id) => programmePageVM(index, id) ?? [])
    .map((page) => ({
      ...page.programme,
      plans: page.standing.plans,
      blocked: page.standing.blocked,
      nextBlocked: page.standing.nextBlocked,
    }))
    .toSorted((a, b) => a.title.localeCompare(b.title));
}

/** The domains a programme's plans land in, most plans first, then in the workspace's order. */
export function landingOf(
  workspace: string,
  plans: readonly string[],
  rows: readonly PlanRow[],
  domains: readonly { readonly id: string; readonly name: string }[],
): LandingVM[] {
  const mine = rows.filter((row) => plans.includes(row.id));
  return domains
    .map((d) => ({
      id: d.id,
      name: d.name,
      href: domainHref(workspace, d.id),
      plans: mine.filter((row) => row.domains.includes(d.id)).length,
    }))
    .filter((d) => d.plans > 0)
    .toSorted((a, b) => b.plans - a.plans);
}

/** A programme's page; null when the workspace has no such programme. */
export function programmePageVM(index: WorkspacePlanIndex, id: string): ProgrammePageVM | null {
  const programme = index.programmes.get(id);
  if (programme === undefined) return null;
  const plans = programme.plans.flatMap((slug) => index.plans.get(slug) ?? []);
  const standings = plans.map((plan) => planStanding(index, plan));
  const held = standings.find((p) => p.blocked);
  const nextBlocked =
    held === undefined ? null : { slug: held.slug, title: held.title, href: held.href };
  return {
    programme: {
      id: programme.id,
      title: programme.title,
      outcome: programme.outcome,
      href: programme.href,
    },
    standing: {
      plans: standings.length,
      landed: standings.filter((p) => p.landed).length,
      blocked: standings.filter((p) => p.blocked).length,
      nextBlocked,
      text: standingText(standings, nextBlocked),
    },
    plans: standings,
    milestones: milestonesOf(index, id, plans),
    decisions: decisionsOf(programme),
    questions: questionsOf(programme),
    partnerDependencies: partnerDependencies(index, plans),
  };
}
