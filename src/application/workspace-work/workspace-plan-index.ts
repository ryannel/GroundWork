import { isRecord, walkStrings } from '@/application/plan/ids';
import type { BaseInfo } from '@/application/plan/plan-base';
import { type Overlap, touchesOf } from '@/application/plan/plan-stack';
import type { RealisationState } from '@/application/plan/realisation';
import type { Inherited } from '@/application/plan/stack-base';
import type { PlanStanding, WorkStanding } from '@/application/plan/work-standing';
import { planHref } from '@/application/plan-pages';
import { thingHref } from '@/application/plan-pages-things';
import { programmeHref } from '@/application/workspace-paths';
import { issueUrlOf } from '@/domain/code-links';
import { inIdScope, withoutIdScope, scopedId, qualifyId, hasPrefix, rootId } from '@/domain/ids';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type {
  Decision,
  Milestone,
  Plan,
  Programme,
  ProgressEvent,
  Question,
} from '@/domain/plan/plan.generated';

import { type TeamVM, workCardVM, type WorkCardVM } from './work-card';

// Every plan of a workspace read once into one index: its plans, programmes, changes and work by key
// (`<plan>/<id>`), the plans each builds on and why, and the overlaps between them. Each screen projects from it.

/** A plan as the workspace's loader read it. */
export interface IndexPlanInput {
  readonly slug: string;
  readonly plan: Plan;
  readonly standing: PlanStanding;
  readonly events: readonly ProgressEvent[];
  readonly status: IssueStatus;
  readonly base: BaseInfo;
  readonly inherited: Inherited;
  readonly overlaps: readonly Overlap[];
}

export interface IndexTeam extends TeamVM {
  readonly contacts: readonly { readonly name: string; readonly role: string | null }[];
}

export interface PlanIndexInput {
  readonly workspace: string;
  readonly plans: readonly IndexPlanInput[];
  readonly programmes: readonly Programme[];
  readonly teams: readonly IndexTeam[];
  /** The recorded systems a thing touches today; an unplaced cross-system flow has several. */
  readonly systemsOf?: (id: string) => readonly string[];
}

export interface IndexedPlan {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
  readonly programme: string | null;
  readonly buildsOn: readonly string[];
  readonly landed: boolean;
  readonly checkedOn: string | null;
  readonly stale: boolean;
  /** Its place when every plan is put after the plans it builds on. */
  readonly order: number;
  readonly milestones: readonly Milestone[];
  readonly standing: PlanStanding;
  readonly events: readonly ProgressEvent[];
  /** Its work items' keys, as written. */
  readonly work: readonly string[];
}

export interface IndexedProgramme {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
  readonly href: string;
  /** The plans that join it, each after the plans it builds on. */
  readonly plans: readonly string[];
  readonly milestones: readonly Milestone[];
  readonly decisions: readonly Decision[];
  readonly questions: readonly Question[];
}

export interface IndexedChange {
  readonly key: string;
  readonly plan: string;
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly realisation: RealisationState | null;
  /** The systems it touches, as far as is known. */
  readonly systems: readonly string[];
}

export interface IndexedWork {
  readonly key: string;
  readonly plan: string;
  readonly standing: WorkStanding;
  readonly card: WorkCardVM;
  /** The work it waits on, by key. */
  readonly dependsOn: readonly string[];
  /** The changes it builds, by key. */
  readonly implements: readonly string[];
  readonly milestone: string | null;
}

export type DependencyHealth = 'ready' | 'waiting' | 'stale' | 'conflict';

/** A plan that reads another (`builds_on`), and the changes there it reads. */
export interface PlanDependency {
  readonly from: string;
  readonly to: string;
  /** The changes of the plan built on that the plan reads, by key. */
  readonly through: readonly string[];
  readonly health: DependencyHealth;
}

export interface WorkspacePlanIndex {
  readonly workspace: string;
  readonly plans: ReadonlyMap<string, IndexedPlan>;
  readonly programmes: ReadonlyMap<string, IndexedProgramme>;
  readonly changes: ReadonlyMap<string, IndexedChange>;
  readonly work: ReadonlyMap<string, IndexedWork>;
  readonly dependencies: readonly PlanDependency[];
  readonly overlaps: readonly Overlap[];
  readonly teams: ReadonlyMap<string, IndexTeam>;
}

const keyOf = (plan: string, id: string): string => scopedId(plan, id);

const rootOf = (id: string): string => rootId(id);

/** Every plan, each after the plans it builds on; plans in a circle keep name order. */
function planOrder(inputs: readonly IndexPlanInput[]): readonly string[] {
  const by = new Map(inputs.map((input) => [input.slug, input]));
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (slug: string): void => {
    if (seen.has(slug)) return;
    seen.add(slug);
    for (const base of by.get(slug)?.plan.builds_on ?? []) visit(base);
    if (by.has(slug)) order.push(slug);
  };
  for (const slug of [...by.keys()].toSorted((a, b) => a.localeCompare(b))) visit(slug);
  return order;
}

const isDone = (standing: WorkStanding): boolean => standing.progress?.state === 'done';

const STOPPED: ReadonlySet<string | null> = new Set(['declined', 'withdrawn']);

/** Held up: something it waits on is open or stopped, its team says it is blocked, or the promise was taken back. */
export const isHeldUp = (work: IndexedWork): boolean =>
  work.standing.blockers.length > 0 ||
  work.standing.progress?.state === 'blocked' ||
  STOPPED.has(work.standing.commitment?.state ?? null);

/** What an add op adds to: the system it adds, or the recorded systems it changes. */
function addedTo(
  kind: string,
  value: Readonly<Record<string, unknown>>,
  systemsOf: (id: string) => readonly string[],
): readonly string[] {
  if (kind === 'system' && typeof value.id === 'string') return [value.id];
  if (typeof value.system === 'string') return [value.system];
  return typeof value.id === 'string' ? systemsOf(value.id) : [];
}

/** An op can touch several systems without assigning a global flow to one of them. */
function systemsOfOp(
  op: Readonly<Record<string, unknown>>,
  systemsOf: (id: string) => readonly string[],
): readonly string[] {
  const { value } = op;
  if (typeof op.add === 'string') {
    const added = isRecord(value) ? addedTo(op.add, value, systemsOf) : [];
    if (added.length > 0) return added;
    return typeof op.into === 'string' ? systemsOf(rootOf(op.into)) : [];
  }
  const target = op.modify ?? op.remove ?? op.deprecate;
  if (typeof target !== 'string') return [];
  return hasPrefix(target, 'sys') ? [target] : systemsOf(target);
}

/** The systems a change touches, from its declared targets and additions. */
function systemsOfChange(
  ops: readonly unknown[],
  systemsOf: (id: string) => readonly string[],
): readonly string[] {
  const found = ops.flatMap((op) => (isRecord(op) ? systemsOfOp(op, systemsOf) : []));
  return [...new Set(found)].toSorted((a, b) => a.localeCompare(b));
}

/** Later plans may change an entity an earlier plan adds, retaining every recorded system. */
function plannedSystems(
  inputs: readonly IndexPlanInput[],
  today: (id: string) => readonly string[],
): (id: string) => readonly string[] {
  const planned = new Map<string, readonly string[]>();
  const systemsOf = (id: string): readonly string[] => {
    const current = today(id);
    return current.length > 0 ? current : (planned.get(id) ?? []);
  };
  for (const op of inputs.flatMap((input) =>
    (input.plan.changes ?? []).flatMap((c) => c.ops ?? []),
  )) {
    if (!isRecord(op) || typeof op.add !== 'string' || !isRecord(op.value)) continue;
    const { id } = op.value;
    const systems = systemsOfOp(op, systemsOf);
    if (typeof id === 'string' && systems.length > 0) planned.set(id, systems);
  }
  return systemsOf;
}

function changesOf(
  input: IndexPlanInput,
  workspace: string,
  systemsOf: (id: string) => readonly string[],
): IndexedChange[] {
  const at = { workspace, slug: input.slug };
  return (input.plan.changes ?? []).map((change) => ({
    key: qualifyId(input.slug, change.id),
    plan: input.slug,
    id: change.id,
    title: change.title,
    href: thingHref(at, change.id),
    realisation: input.standing.changes.find((each) => each.change === change.id)?.state ?? null,
    systems: systemsOfChange(change.ops ?? [], systemsOf),
  }));
}

function workOf(input: IndexPlanInput, workspace: string, programmes: readonly string[]) {
  const items = input.plan.work_items ?? [];
  return input.standing.work.flatMap((standing): IndexedWork[] => {
    const item = items.find((w) => w.id === standing.item.id);
    if (item === undefined) return [];
    const issue = input.status[item.id];
    const milestone = (input.plan.milestones ?? []).find((m) => m.id === item.milestone);
    const card = workCardVM(standing, {
      workspace,
      plan: input.slug,
      programmes,
      milestoneLabel: milestone?.name ?? null,
      issue: {
        url: issue?.url ?? defaultIssueUrl(item.repo, item.github_issue),
        state: issue?.state ?? null,
      },
    });
    return [
      {
        key: card.key,
        plan: input.slug,
        standing,
        card,
        dependsOn: (item.depends_on ?? []).map((id) => keyOf(input.slug, id)),
        implements: (item.implements ?? []).map((id) => keyOf(input.slug, id)),
        milestone: item.milestone === undefined ? null : keyOf(input.slug, item.milestone),
      },
    ];
  });
}

const REPO = /^[\w.-]+\/[\w.-]+$/u;

function defaultIssueUrl(repo: string | undefined, issue: number | undefined): string | null {
  if (repo === undefined || issue === undefined || !REPO.test(repo)) return null;
  return issueUrlOf(repo, issue);
}

/** Every string a plan's changes use: the ids it reads are among them. */
function referencesOf(plan: Plan): ReadonlySet<string> {
  const found = new Set<string>();
  walkStrings(plan.changes ?? [], (text) => {
    found.add(text);
    found.add(rootOf(text));
  });
  return found;
}

/** The changes of a base that the plan reads: what it targets that the base touched, and the work it waits on. */
function throughOf(input: IndexPlanInput, base: IndexPlanInput): readonly string[] {
  const refs = referencesOf(input.plan);
  const touched = touchesOf(base.plan)
    .filter((touch) => refs.has(touch.target) || refs.has(rootOf(touch.target)))
    .map((touch) => touch.change);
  const waitedOn = (input.plan.work_items ?? [])
    .flatMap((w) => w.depends_on ?? [])
    .filter((id) => inIdScope(id, base.slug))
    .map((id) => withoutIdScope(id, base.slug))
    .flatMap((id) => (base.plan.work_items ?? []).find((w) => w.id === id)?.implements ?? []);
  return [...new Set([...touched, ...waitedOn])]
    .map((change) => qualifyId(base.slug, change))
    .toSorted((a, b) => a.localeCompare(b));
}

/** Every plan a plan reaches through builds_on. */
function closureOf(slug: string, by: ReadonlyMap<string, IndexPlanInput>): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (each: string): void => {
    for (const next of by.get(each)?.plan.builds_on ?? []) {
      if (found.has(next)) continue;
      found.add(next);
      walk(next);
    }
  };
  walk(slug);
  return found;
}

function healthOf(
  input: IndexPlanInput,
  base: IndexPlanInput,
  overlaps: readonly Overlap[],
  by: ReadonlyMap<string, IndexPlanInput>,
): DependencyHealth {
  const reads = closureOf(input.slug, by);
  const clash = overlaps.some(
    (o) => o.plans.includes(base.slug) && o.plans.every((plan) => reads.has(plan)),
  );
  if (clash) return 'conflict';
  if (input.base.builtOn.some((each) => each.slug === base.slug && each.changed)) return 'stale';
  if (base.base.mode === 'landed') return 'ready';
  const work = base.standing.work;
  return work.length > 0 && work.every((w) => isDone(w)) ? 'ready' : 'waiting';
}

function dependenciesOf(
  inputs: readonly IndexPlanInput[],
  overlaps: readonly Overlap[],
): PlanDependency[] {
  const by = new Map(inputs.map((input) => [input.slug, input]));
  return inputs.flatMap((input) =>
    (input.plan.builds_on ?? []).flatMap((slug): PlanDependency[] => {
      const base = by.get(slug);
      if (base === undefined) return [];
      return [
        {
          from: input.slug,
          to: slug,
          through: throughOf(input, base),
          health: healthOf(input, base, overlaps, by),
        },
      ];
    }),
  );
}

function overlapsIn(inputs: readonly IndexPlanInput[]): Overlap[] {
  const found = new Map<string, Overlap>();
  for (const overlap of inputs.flatMap((input) => input.overlaps)) {
    found.set(`${overlap.target}\n${overlap.changes.join('\n')}`, overlap);
  }
  return [...found.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([, o]) => o);
}

const noSystem = (): readonly string[] => [];

/** The workspace's plans read into one index. */
export function workspacePlanIndexOf(input: PlanIndexInput): WorkspacePlanIndex {
  const { workspace } = input;
  const order = planOrder(input.plans);
  const sorted = order.flatMap((slug) => input.plans.find((each) => each.slug === slug) ?? []);
  const programmeIds = input.programmes.map((p) => p.id);
  const plans = new Map(
    sorted.map((each, i): [string, IndexedPlan] => [
      each.slug,
      {
        slug: each.slug,
        title: each.plan.meta.title,
        href: planHref({ workspace, slug: each.slug }),
        programme: each.plan.meta.programme ?? null,
        buildsOn: each.plan.builds_on ?? [],
        landed: each.base.mode === 'landed',
        checkedOn: each.base.checkedOn,
        stale: each.base.stale,
        order: i,
        milestones: each.plan.milestones ?? [],
        standing: each.standing,
        events: each.events,
        work: (each.plan.work_items ?? []).map((w) => qualifyId(each.slug, w.id)),
      },
    ]),
  );
  const programmes = new Map(
    input.programmes.map((p): [string, IndexedProgramme] => [
      p.id,
      {
        id: p.id,
        title: p.title,
        outcome: p.outcome,
        href: programmeHref(workspace, p.id),
        plans: order.filter((slug) => plans.get(slug)?.programme === p.id),
        milestones: p.milestones ?? [],
        decisions: p.decisions ?? [],
        questions: p.questions ?? [],
      },
    ]),
  );
  const systemsOf = plannedSystems(sorted, input.systemsOf ?? noSystem);
  const changes = sorted.flatMap((each) => changesOf(each, workspace, systemsOf));
  const work = sorted.flatMap((each) => workOf(each, workspace, programmeIds));
  const overlaps = overlapsIn(sorted);
  return {
    workspace,
    plans,
    programmes,
    changes: new Map(changes.map((c) => [c.key, c])),
    work: new Map(work.map((w) => [w.key, w])),
    dependencies: dependenciesOf(sorted, overlaps),
    overlaps,
    teams: new Map(input.teams.map((team) => [team.id, team])),
  };
}

/** Done: its latest work event says so. */
export const workDone = (work: IndexedWork): boolean => isDone(work.standing);
