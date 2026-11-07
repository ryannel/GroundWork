import type { ModelIndex } from '@/application/model-index';
import { modelPlanFootprintOf } from '@/application/model-plan-footprint';
import { modelStandingContextOf } from '@/application/model-plan-standing';
import type { ModelPlanProgress } from '@/application/model-progress';
import {
  standingOf,
  type MilestoneStanding,
  type WorkStanding,
} from '@/application/plan/work-standing';
import { planHref } from '@/application/plan-navigation';
import { thingHref } from '@/application/thing-paths';
import { workOrderOf } from '@/application/work-order';
import { partnerHref, programmeHref } from '@/application/workspace-paths';
import { type PartnerRowVM, ageText } from '@/application/workspace-work/partners';
import type { ProgrammeRowVM } from '@/application/workspace-work/programme-page';
import { workCardVM, type WorkCardVM } from '@/application/workspace-work/work-card';
import { isAuthoredReference, qualifyId, stripPrefix } from '@/domain/ids';
import {
  modelRecord,
  modelText,
  type ModelPlan,
  type ModelData,
  type ModelGap,
} from '@/domain/workspace-model';
import { plural } from '@/shared/text';

export interface ModelWorkPlan {
  readonly slug: string;
  readonly plan: ModelPlan;
  readonly progress?: ModelPlanProgress | null;
  readonly landed?: boolean;
}
export interface ModelWorkPlanView {
  readonly slug: string;
  readonly workspace: string;
  readonly title: string;
  readonly landed: boolean | null;
  readonly href: string;
  readonly buildsOn: readonly {
    readonly id: string;
    readonly title: string;
    readonly href: string | null;
  }[];
  readonly work: readonly {
    readonly source: NonNullable<ModelPlan['work_items']>[number];
    readonly partner: boolean;
    readonly card: WorkCardVM;
    readonly state: string;
    readonly events: ModelPlanProgress['events'];
  }[];
  readonly milestones: NonNullable<ModelPlan['milestones']>;
  readonly milestoneStanding: readonly MilestoneStanding[];
  readonly events: ModelPlanProgress['events'];
  readonly errors: readonly { readonly message: string }[];
  readonly progressMissing: boolean;
  readonly progress: ModelPlanProgress | null;
  readonly references: Readonly<Record<string, { readonly label: string; readonly href: string }>>;
}
function planMetadata(plan: ModelPlan): readonly unknown[] {
  return [
    { id: plan.meta.id, title: plan.meta.title },
    ...(plan.work_items ?? []),
    ...(plan.milestones ?? []),
    ...plan.changes,
    ...(plan.decisions ?? []),
    ...(plan.questions ?? []),
    ...(plan.risks ?? []),
    ...(plan.tests ?? []),
  ];
}
function planReferences(
  workspace: string,
  entry: ModelWorkPlan,
  all: readonly ModelWorkPlan[],
): ModelWorkPlanView['references'] {
  const references = (candidate: ModelWorkPlan, local: boolean) =>
    planMetadata(candidate.plan).flatMap((value) => {
      const data = modelRecord(value);
      const id = modelText(data?.id);
      if (data === null || id === null) return [];
      const label = modelText(data.title) ?? modelText(data.name) ?? modelText(data.question) ?? id;
      return [
        [
          local ? id : qualifyId(candidate.slug, id),
          { label, href: thingHref({ workspace, slug: candidate.slug }, id) },
        ],
      ] as const;
    });
  return Object.fromEntries([
    ...all.flatMap((candidate) => references(candidate, false)),
    ...references(entry, true),
  ]);
}
function workRow(
  source: NonNullable<ModelPlan['work_items']>[number],
  standing: readonly WorkStanding[],
  entry: ModelWorkPlan,
  workspace: string,
  programmes: readonly string[],
  events: ModelPlanProgress['events'],
): ModelWorkPlanView['work'][number] {
  const actual = standing.find((candidate) => candidate.item.id === source.id);
  if (actual === undefined) throw new Error(`Standing missing for declared work item ${source.id}`);
  const milestone = entry.plan.milestones?.find((candidate) => candidate.id === source.milestone);
  const issue = entry.progress?.status[source.id];
  const card = workCardVM(actual, {
    workspace,
    plan: entry.slug,
    programmes,
    milestoneLabel: milestone?.name ?? null,
    issue: issue === undefined ? null : { url: issue.url ?? null, state: issue.state },
  });
  return {
    source,
    card,
    partner: actual.team.partner,
    state: actual.progress?.state ?? 'No work state recorded',
    events: events.filter((event) => event.subject === source.id),
  };
}
function workPlan(
  index: ModelIndex,
  entry: ModelWorkPlan,
  all: readonly ModelWorkPlan[],
  team?: string,
): ModelWorkPlanView {
  const items = workOrderOf(
    (entry.plan.work_items ?? []).filter((item) => team === undefined || item.team === team),
    entry.plan.milestones ?? [],
  );
  const subjects = new Set(
    items.flatMap((item) => [item.id, ...(item.milestone === undefined ? [] : [item.milestone])]),
  );
  const context = modelStandingContextOf(
    index.model,
    all.map((candidate) => ({
      scope: candidate.slug,
      plan: candidate.plan,
      progress: { events: candidate.progress?.events ?? [] },
    })),
  );
  const recorded = entry.progress ?? null;
  const allEvents = recorded === null ? [] : recorded.events;
  const standing = standingOf(entry.plan, { events: allEvents }, context);
  const events = allEvents.filter((event) => team === undefined || subjects.has(event.subject));
  return {
    slug: entry.slug,
    workspace: index.model.id,
    references: planReferences(index.model.id, entry, all),
    title: entry.plan.meta.title,
    landed: entry.landed ?? null,
    href: planHref({ workspace: index.model.id, slug: entry.slug }),
    buildsOn: (entry.plan.builds_on ?? []).map((id) => {
      const target = all.find((candidate) => candidate.plan.meta.id === id);
      return {
        id,
        title: target?.plan.meta.title ?? id,
        href:
          target === undefined ? null : planHref({ workspace: index.model.id, slug: target.slug }),
      };
    }),
    work: items.map((source) =>
      workRow(
        source,
        standing.work,
        entry,
        index.model.id,
        index.model.programmes.map((programme) => stripPrefix(programme.id, 'prog')),
        events,
      ),
    ),
    milestoneStanding: standing.milestones.filter(
      (milestone) => team === undefined || subjects.has(milestone.milestone.id),
    ),
    milestones: (entry.plan.milestones ?? []).filter(
      (milestone) => team === undefined || subjects.has(milestone.id),
    ),
    events,
    errors: recorded === null ? [] : recorded.errors,
    progressMissing: recorded === null,
    progress: recorded === null ? null : { ...recorded, events },
  };
}
function heldUp(item: ModelWorkPlanView['work'][number]): boolean {
  const commitment = item.card.commitment?.state;
  const declined = commitment === 'declined' || commitment === 'withdrawn';
  return !item.card.done && (item.card.blockers.length > 0 || item.state === 'blocked' || declined);
}
function plansInOrder(entries: readonly ModelWorkPlan[]): readonly ModelWorkPlan[] {
  const ordered = workOrderOf(
    entries.map(({ plan }) => ({ id: plan.meta.id, depends_on: plan.builds_on ?? [] })),
    [],
  );
  const byId = new Map(entries.map((entry) => [entry.plan.meta.id, entry]));
  return ordered.flatMap(({ id }) => byId.get(id) ?? []);
}
export function modelProgrammeRowsOf(
  index: ModelIndex,
  entries: readonly ModelWorkPlan[],
): readonly ProgrammeRowVM[] {
  const ordered = plansInOrder(entries);
  return index.model.programmes
    .map((programme) => {
      const plans = ordered
        .filter((entry) => entry.plan.meta.programme === programme.id)
        .map((entry) => workPlan(index, entry, entries));
      const held = plans.filter((plan) => plan.landed !== true && plan.work.some(heldUp));
      const next = held[0];
      const recorded =
        held.length === 0 ? '' : `${plural(held.length, 'plan')} with recorded work held up. `;
      return {
        id: programme.id,
        title: programme.title,
        outcome: programme.outcome,
        href: programmeHref(index.model.id, stripPrefix(programme.id, 'prog')),
        plans: plans.length,
        blocked: held.length,
        nextBlocked:
          next === undefined ? null : { slug: next.slug, title: next.title, href: next.href },
        unknownProgress: `${recorded}Dependency freshness has not been evaluated.`,
      };
    })
    .toSorted((left, right) => left.title.localeCompare(right.title));
}
export function modelPartnerRowsOf(
  index: ModelIndex,
  entries: readonly ModelWorkPlan[],
  today: string,
): readonly PartnerRowVM[] {
  return (index.model.teams ?? [])
    .filter((team) => team.partner === true)
    .map((team) => {
      const plans = entries.filter((entry) =>
        (entry.plan.work_items ?? []).some((item) => item.team === team.id),
      );
      const views = plans.map((entry) => workPlan(index, entry, entries, team.id));
      const work = views.flatMap((view) => view.work);
      const unknown = work.filter((item) => item.state === 'No work state recorded').length;
      const missingWork = `${plural(unknown, 'work item')} ${unknown === 1 ? 'has' : 'have'} no recorded state.`;
      const newest = views
        .flatMap((view) => view.events)
        .toSorted((a, b) => b.at.localeCompare(a.at))[0];
      return {
        id: team.id,
        name: team.name,
        href: partnerHref(index.model.id, team.id),
        systems: index.model.domains.flatMap((domain) =>
          domain.systems
            .filter((system) => system.team === team.id)
            .map((system) => ({ id: system.id, name: system.name, href: index.href(system.id) })),
        ),
        work: {
          total: work.length,
          plans: plans.length,
          open: work.filter((item) => !item.card.done && item.state !== 'No work state recorded')
            .length,
          blocked: work.filter(heldUp).length,
        },
        unknownProgress: unknown > 0 ? missingWork : undefined,
        lastHeard: newest === undefined ? null : { at: newest.at, age: ageText(newest.at, today) },
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));
}
export interface ModelPartnerPage {
  readonly team: ModelData<'Team'>;
  readonly plans: readonly ModelWorkPlanView[];
}
export interface ModelProgrammePage {
  readonly programme: ModelData<'ProgrammeFile'>;
  readonly plans: readonly ModelWorkPlanView[];
  readonly landing: readonly {
    readonly id: string;
    readonly name: string;
    readonly href: string;
    readonly plans: number;
  }[];
  readonly gaps: readonly ModelGap[];
  readonly partnerDependencies: readonly {
    readonly plan: string;
    readonly href: string;
    readonly item: NonNullable<ModelPlan['work_items']>[number];
  }[];
}
export function modelPartnerOf(
  index: ModelIndex,
  slug: string,
  entries: readonly ModelWorkPlan[],
): ModelPartnerPage | null {
  const team = (index.model.teams ?? []).find(
    (candidate) =>
      candidate.partner === true &&
      (candidate.id === slug || stripPrefix(candidate.id, 'team') === slug),
  );
  if (team === undefined) return null;
  return {
    team,
    plans: entries
      .filter((entry) => (entry.plan.work_items ?? []).some((item) => item.team === team.id))
      .map((entry) => workPlan(index, entry, entries, team.id)),
  };
}
export function modelProgrammeOf(
  index: ModelIndex,
  slug: string,
  entries: readonly ModelWorkPlan[],
): ModelProgrammePage | null {
  const programme = index.model.programmes.find(
    (candidate) => candidate.id === slug || stripPrefix(candidate.id, 'prog') === slug,
  );
  if (programme === undefined) return null;
  const selected = plansInOrder(entries).filter(
    (entry) => entry.plan.meta.programme === programme.id,
  );
  const footprints = selected.map((entry) =>
    modelPlanFootprintOf(
      entry.plan,
      entries.map((candidate) => candidate.plan),
      index,
    ),
  );
  return {
    programme,
    plans: selected.map((entry) => workPlan(index, entry, entries)),
    landing: index.model.domains.flatMap((domain) => {
      const plans = footprints.filter((footprint) => footprint.domains.includes(domain.id)).length;
      return plans === 0
        ? []
        : [{ id: domain.id, name: domain.name, href: index.href(domain.id), plans }];
    }),
    gaps: footprints.flatMap((footprint) => footprint.gaps),
    partnerDependencies: selected.flatMap((entry) =>
      (entry.plan.work_items ?? [])
        .filter((item) =>
          (index.model.teams ?? []).some((team) => team.id === item.team && team.partner === true),
        )
        .map((item) => ({
          plan: entry.plan.meta.title,
          href: planHref({ workspace: index.model.id, slug: entry.slug }),
          item,
        })),
    ),
  };
}

/** Only labels referenced by this page travel with its bounded record values. */
export function modelWorkLabelsOf(
  index: ModelIndex,
  entries: readonly ModelWorkPlan[],
  value: unknown,
): Readonly<Record<string, string>> {
  const metadata = new Map(
    entries.flatMap(({ plan }) => [
      [plan.meta.id, plan.meta.title] as const,
      ...(plan.work_items ?? []).map((item) => [item.id, item.title] as const),
      ...(plan.milestones ?? []).map((item) => [item.id, item.name] as const),
      ...(plan.decisions ?? []).map((item) => [item.id, item.title] as const),
    ]),
  );
  const labels = new Map<string, string>();
  const visit = (itemValue: unknown): void => {
    if (typeof itemValue === 'string') {
      const ids = itemValue
        .split('[[')
        .slice(1)
        .flatMap((part) => {
          const end = part.indexOf(']]');
          return end === -1 ? [] : [part.slice(0, end).split('|')[0] ?? ''];
        });
      if (isAuthoredReference(itemValue)) ids.push(itemValue);
      for (const id of ids) labels.set(id, metadata.get(id) ?? index.label(id));
    } else if (Array.isArray(itemValue)) for (const item of itemValue) visit(item);
    else if (itemValue !== null && typeof itemValue === 'object') {
      const values: readonly unknown[] = Object.values(itemValue);
      for (const item of values) visit(item);
    }
  };
  visit(value);
  return Object.fromEntries(labels);
}
