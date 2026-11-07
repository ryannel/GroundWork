import { latestEvent, sourceUrl } from '@/application/plan/progress';
import type { ChangeRealisation } from '@/application/plan/realisation';
import { qualifiedOf, kindOf } from '@/domain/ids';
import type { ProgressEvent } from '@/domain/plan/plan.generated';
import type { ModelPlan } from '@/domain/workspace-model';

export interface StandingProgress {
  readonly events: readonly ProgressEvent[];
}

type WorkItem = NonNullable<ModelPlan['work_items']>[number];
type Milestone = NonNullable<ModelPlan['milestones']>[number];
export type StandingPlan = Pick<
  ModelPlan,
  'work_items' | 'milestones' | 'decisions' | 'questions'
> & { readonly teams?: readonly { readonly id: string; readonly name: string }[] };

// Where each piece of a plan's work stands, from progress.yaml: what its team has promised (commitment), what has
// happened (progress) and when we last heard. The two are never mixed, and realisation (whether today now says
// what the plan said) is worked out apart, in realisation.ts.

export type CommitmentState = 'proposed' | 'accepted' | 'declined' | 'withdrawn';
export type ProgressState = 'not_started' | 'in_progress' | 'blocked' | 'done';
type EventSource = NonNullable<ProgressEvent['source']>;
export type SourceKind = EventSource['kind'];
export type Confidence = 'high' | 'medium' | 'low';

/** Where an event came from: its kind, a link to the evidence, and the GitHub issue when it names one. */
export interface StandingSource {
  readonly kind: SourceKind;
  readonly url: string | null;
  readonly repo: string | null;
  readonly issue: number | null;
  readonly note: string | null;
}

/** What a team has promised for a work item or milestone: its latest commitment event. */
export interface Commitment {
  readonly state: CommitmentState;
  readonly promisedFor: string | null;
  readonly confidence: Confidence | null;
  readonly saidBy: string | null;
  readonly at: string;
  readonly source: StandingSource | null;
}

/** What has happened to a work item: its latest work event, GitHub's included. */
export interface WorkProgress {
  readonly state: ProgressState;
  readonly at: string;
  readonly source: StandingSource | null;
}

/** The newest event of any kind. */
export interface LastHeard {
  readonly at: string;
  readonly by: string | null;
  readonly sourceKind: SourceKind | null;
  readonly url: string | null;
}

/** When we need it, when its team promised it, and how many days later than needed the promise is. */
export interface StandingDates {
  readonly neededBy: string | null;
  readonly promisedFor: string | null;
  /** Promised minus needed, in days: positive is later than we need it. Null without both dates. */
  readonly gapDays: number | null;
}

/** Why a work item or milestone is blocked: a dependency that was declined or withdrawn, or an open gate. */
export interface BlockReason {
  readonly kind: 'depends-on' | 'after' | 'question' | 'decision';
  readonly id: string;
  readonly label: string;
  /** The dependency's commitment, the question's or the decision's status. */
  readonly state: string | null;
}

export interface StandingTeam {
  readonly id: string;
  readonly name: string;
  readonly partner: boolean;
}

/** Where one work item stands. */
export interface WorkStanding {
  readonly item: {
    readonly id: string;
    readonly title: string;
    readonly milestone: string | null;
    readonly issue: number | null;
  };
  readonly team: StandingTeam;
  readonly commitment: Commitment | null;
  readonly progress: WorkProgress | null;
  readonly lastHeard: LastHeard | null;
  readonly dates: StandingDates;
  readonly blockers: readonly BlockReason[];
}

/** Where one milestone stands: its own commitment, and the commitment rolled up from it and its items. */
export interface MilestoneStanding {
  readonly milestone: {
    readonly id: string;
    readonly name: string;
    readonly serves: string | null;
  };
  readonly commitment: Commitment | null;
  /** Declined or withdrawn if any is, accepted only when every one is, proposed when any is said, else null. */
  readonly rollup: CommitmentState | null;
  readonly items: readonly string[];
  readonly lastHeard: LastHeard | null;
  readonly dates: StandingDates;
  readonly blockers: readonly BlockReason[];
}

/** When we last heard from a team, about any of its work items. */
export interface TeamStanding {
  readonly team: StandingTeam;
  readonly items: readonly string[];
  readonly lastHeard: LastHeard | null;
}

/** Where a plan's work stands, and how far today says what its changes said. Plain data. */
export interface PlanStanding {
  readonly work: readonly WorkStanding[];
  readonly milestones: readonly MilestoneStanding[];
  readonly teams: readonly TeamStanding[];
  readonly changes: readonly ChangeRealisation[];
}

export const NO_STANDING: PlanStanding = { work: [], milestones: [], teams: [], changes: [] };

/** What the plans and programmes beside this one say, by qualified id (`<plan>/wi:x`, `<programme>/q:y`). */
export interface Elsewhere {
  /** The commitment of a work item, or the rolled-up commitment of a milestone, in another plan. */
  readonly commitments: Readonly<Record<string, CommitmentState | null>>;
  /** The status of a question or decision in another plan or programme. */
  readonly statuses: Readonly<Record<string, string | null>>;
  readonly labels: Readonly<Record<string, string>>;
}

const NOWHERE: Elsewhere = { commitments: {}, statuses: {}, labels: {} };

/** What standing reads beyond the plan and its record: the workspace's teams and the plans beside it. */
export interface StandingContext {
  readonly teams: readonly StandingTeam[];
  readonly elsewhere?: Elsewhere | undefined;
}

const DAY_MS = 86_400_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})/u;

/** Days since 1970-01-01 for a YYYY-MM-DD (or a date-time's day); null when it is not one. */
function dayNumber(day: string): number | null {
  const m = DAY.exec(day);
  if (m === null) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

/** Promised minus needed, in whole days: positive when the promise is later than the need. */
export function gapDays(promisedFor: string | null, neededBy: string | null): number | null {
  const promised = promisedFor === null ? null : dayNumber(promisedFor);
  const needed = neededBy === null ? null : dayNumber(neededBy);
  return promised === null || needed === null ? null : promised - needed;
}

const datesOf = (neededBy: string | null, promisedFor: string | null): StandingDates => ({
  neededBy,
  promisedFor,
  gapDays: gapDays(promisedFor, neededBy),
});

function sourceOf(event: ProgressEvent): StandingSource | null {
  const { source } = event;
  if (source === undefined) return null;
  return {
    kind: source.kind,
    url: sourceUrl(event) ?? null,
    repo: source.repo ?? null,
    issue: source.issue ?? null,
    note: source.note ?? null,
  };
}

const isCommitmentState = (state: ProgressEvent['state']): state is CommitmentState =>
  state === 'proposed' || state === 'accepted' || state === 'declined' || state === 'withdrawn';

const isProgressState = (state: ProgressEvent['state']): state is ProgressState =>
  state === 'not_started' || state === 'in_progress' || state === 'blocked' || state === 'done';

/** The latest commitment among these events, or null when none was made. */
function commitmentOf(events: readonly ProgressEvent[]): Commitment | null {
  const event = latestEvent(events, (e) => e.kind === 'commitment' && isCommitmentState(e.state));
  if (event === null || !isCommitmentState(event.state)) return null;
  return {
    state: event.state,
    promisedFor: event.promised_for ?? null,
    confidence: event.confidence ?? null,
    saidBy: event.said_by ?? null,
    at: event.at,
    source: sourceOf(event),
  };
}

/** The latest work event among these, GitHub's included, or null when nothing has happened. */
function progressOf(events: readonly ProgressEvent[]): WorkProgress | null {
  const event = latestEvent(events, (e) => e.kind === 'work' && isProgressState(e.state));
  if (event === null || !isProgressState(event.state)) return null;
  return { state: event.state, at: event.at, source: sourceOf(event) };
}

/** The newest event of any kind among these. */
export function lastHeardOf(events: readonly ProgressEvent[]): LastHeard | null {
  const event = latestEvent(events, () => true);
  if (event === null) return null;
  return {
    at: event.at,
    by: event.said_by ?? null,
    sourceKind: event.source?.kind ?? null,
    url: sourceUrl(event) ?? null,
  };
}

/**
 * A milestone's commitment from its own and its items': declined if any is declined, withdrawn if any is
 * withdrawn, accepted only when every one is accepted (an item with no commitment is not), proposed when any
 * commitment is said, and null when none is.
 */
export function rollUpCommitment(
  own: CommitmentState | null,
  items: readonly (CommitmentState | null)[],
): CommitmentState | null {
  const all = own === null ? items : [own, ...items];
  const said = all.filter((state) => state !== null);
  if (said.includes('declined')) return 'declined';
  if (said.includes('withdrawn')) return 'withdrawn';
  if (said.length === 0) return null;
  return all.every((state) => state === 'accepted') ? 'accepted' : 'proposed';
}

/** The parts of a plan its commitments are read from. */
export interface PlanWork {
  readonly work_items?: readonly Pick<WorkItem, 'id' | 'milestone'>[] | undefined;
  readonly milestones?: readonly Pick<Milestone, 'id'>[] | undefined;
}

function eventsBySubject(
  progress: StandingProgress,
): ReadonlyMap<string, readonly ProgressEvent[]> {
  const by = new Map<string, ProgressEvent[]>();
  for (const event of progress.events) {
    by.set(event.subject, [...(by.get(event.subject) ?? []), event]);
  }
  return by;
}

/** The commitment of each work item, and the rolled-up commitment of each milestone, by id. */
export function commitmentsOf(
  plan: PlanWork,
  progress: StandingProgress,
): Readonly<Record<string, CommitmentState | null>> {
  const by = eventsBySubject(progress);
  const stateOf = (id: string): CommitmentState | null =>
    commitmentOf(by.get(id) ?? [])?.state ?? null;
  const items = plan.work_items ?? [];
  const milestones = (plan.milestones ?? []).map((m) => {
    const states = items.filter((w) => w.milestone === m.id).map((w) => stateOf(w.id));
    return [m.id, rollUpCommitment(stateOf(m.id), states)] as const;
  });
  return Object.fromEntries([...items.map((w) => [w.id, stateOf(w.id)] as const), ...milestones]);
}

const STOPPED: ReadonlySet<string | null> = new Set(['declined', 'withdrawn']);

interface Reading {
  readonly plan: StandingPlan;
  readonly commitments: Readonly<Record<string, CommitmentState | null>>;
  readonly elsewhere: Elsewhere;
}

function localLabel(plan: StandingPlan, id: string): string {
  const named = [
    ...(plan.work_items ?? []).map((w) => [w.id, w.title] as const),
    ...(plan.milestones ?? []).map((m) => [m.id, m.name] as const),
    ...(plan.decisions ?? []).map((d) => [d.id, d.title] as const),
    ...(plan.questions ?? []).map((q) => [q.id, q.question] as const),
  ];
  return named.find(([each]) => each === id)?.[1] ?? id;
}

const labelOf = (r: Reading, id: string): string =>
  qualifiedOf(id) === null ? localLabel(r.plan, id) : (r.elsewhere.labels[id] ?? id);

/** A dependency on a work item or milestone, here or in another plan, that was declined or withdrawn. */
function stoppedBy(r: Reading, id: string, kind: 'depends-on' | 'after'): BlockReason | null {
  const state =
    qualifiedOf(id) === null ? (r.commitments[id] ?? null) : (r.elsewhere.commitments[id] ?? null);
  return STOPPED.has(state) ? { kind, id, label: labelOf(r, id), state } : null;
}

/** A question's status here, read as open while the decision that answers it is not accepted. */
function questionStatus(plan: StandingPlan, id: string): string | null {
  const question = (plan.questions ?? []).find((q) => q.id === id);
  if (question === undefined) return null;
  const answer = (plan.decisions ?? []).find((d) => d.id === question.answered_by);
  return answer?.status === 'accepted' ? 'resolved' : question.status;
}

function gateStatus(r: Reading, id: string): string | null {
  if (qualifiedOf(id) !== null) return r.elsewhere.statuses[id] ?? null;
  if (kindOf(id) === 'question') return questionStatus(r.plan, id);
  return (r.plan.decisions ?? []).find((d) => d.id === id)?.status ?? null;
}

const UNDECIDED: ReadonlySet<string | null> = new Set(['proposed', 'deferred']);

/** An open question, or a decision not yet made, that a work item waits on. */
function gatedBy(r: Reading, id: string): BlockReason | null {
  const type = kindOf(qualifiedOf(id)?.id ?? id);
  const status = gateStatus(r, id);
  if (type === 'question' && status === 'open') {
    return { kind: 'question', id, label: labelOf(r, id), state: status };
  }
  if (type === 'decision' && UNDECIDED.has(status)) {
    return { kind: 'decision', id, label: labelOf(r, id), state: status };
  }
  return null;
}

function itemBlockers(r: Reading, item: WorkItem): BlockReason[] {
  return [
    ...(item.depends_on ?? []).flatMap((id) => stoppedBy(r, id, 'depends-on') ?? []),
    ...(item.blocked_by ?? []).flatMap((id) => gatedBy(r, id) ?? []),
  ];
}

function teamOf(item: WorkItem, plan: StandingPlan, teams: readonly StandingTeam[]): StandingTeam {
  const known = teams.find((t) => t.id === item.team);
  if (known !== undefined) return known;
  const named = (plan.teams ?? []).find((t) => t.id === item.team)?.name;
  return { id: item.team, name: named ?? item.team, partner: false };
}

/** Where every work item, milestone and team of a plan stands, from its progress record. No realisation. */
export function standingOf(
  plan: StandingPlan,
  progress: StandingProgress,
  context: StandingContext,
): Omit<PlanStanding, 'changes'> {
  const by = eventsBySubject(progress);
  const eventsOf = (id: string): readonly ProgressEvent[] => by.get(id) ?? [];
  const heardAbout = (ids: readonly string[]): LastHeard | null =>
    lastHeardOf(progress.events.filter((event) => ids.includes(event.subject)));
  const r: Reading = {
    plan,
    commitments: commitmentsOf(plan, progress),
    elsewhere: context.elsewhere ?? NOWHERE,
  };
  const items = plan.work_items ?? [];
  const milestones = plan.milestones ?? [];
  const dueOf = (id: string | undefined): string | null =>
    milestones.find((m) => m.id === id)?.due ?? null;

  const work = items.map((item): WorkStanding => {
    const commitment = commitmentOf(eventsOf(item.id));
    return {
      item: {
        id: item.id,
        title: item.title,
        milestone: item.milestone ?? null,
        issue: item.github_issue ?? null,
      },
      team: teamOf(item, plan, context.teams),
      commitment,
      progress: progressOf(eventsOf(item.id)),
      lastHeard: lastHeardOf(eventsOf(item.id)),
      dates: datesOf(item.needed_by ?? dueOf(item.milestone), commitment?.promisedFor ?? null),
      blockers: itemBlockers(r, item),
    };
  });

  const standings = milestones.map((m): MilestoneStanding => {
    const members = work.filter((w) => w.item.milestone === m.id);
    const commitment = commitmentOf(eventsOf(m.id));
    const promised =
      members
        .flatMap((w) => w.dates.promisedFor ?? [])
        .toSorted((a, b) => a.localeCompare(b))
        .at(-1) ?? null;
    return {
      milestone: { id: m.id, name: m.name, serves: m.serves ?? null },
      commitment,
      rollup: r.commitments[m.id] ?? null,
      items: members.map((w) => w.item.id),
      lastHeard: heardAbout([m.id, ...members.map((w) => w.item.id)]),
      dates: datesOf(m.due ?? null, commitment?.promisedFor ?? promised),
      blockers: (m.after ?? []).flatMap((id) => stoppedBy(r, id, 'after') ?? []),
    };
  });

  const teamIds = [...new Set(items.map((item) => item.team))];
  const teams = teamIds.map((id): TeamStanding => {
    const own = work.filter((w) => w.team.id === id);
    return {
      team: own[0]?.team ?? { id, name: id, partner: false },
      items: own.map((w) => w.item.id),
      lastHeard: heardAbout(own.map((w) => w.item.id)),
    };
  });

  return { work, milestones: standings, teams };
}
