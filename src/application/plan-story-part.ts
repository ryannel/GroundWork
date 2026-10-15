import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import type { Deciding } from '@/application/plan-viz-decision';
import { plainLine } from '@/application/plan-viz-text';
import { voteSummary } from '@/application/plan-viz-vote';
import { criticalSet, wiState, workOrdered, type WorkState } from '@/application/plan-viz-work';
import type { Commitment, Question, Risk, WorkItem } from '@/domain/plan/plan.generated';

import { gatesOf, heldUp, isApproved, planStage, type Stage } from './plan-story-cover-standing';
import { connections, type Connections } from './plan-story-part-links';

// What the plan asks of one team: what it decides and waits on before approval, which of its steps change, what it
// builds, and who it talks to. One reading for the team's page and for the one line per team on the page for everyone.

export type StepKind = 'new' | 'differently' | 'rerouted' | 'removed';

export interface StepChange {
  readonly flow: string;
  readonly id: string;
  readonly kind: StepKind;
  readonly action: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly via: string | null;
  /** The caller's route is unchanged: only what the step does changed. */
  readonly caller: string | null;
  readonly sameCall: boolean;
}

export interface Waiting {
  readonly gate: Deciding;
  readonly held: readonly string[];
}

export interface TeamPart {
  readonly stage: Stage;
  readonly services: readonly string[];
  readonly changes: readonly string[];
  readonly tests: readonly string[];
  readonly decides: readonly Deciding[];
  readonly waitsOn: readonly Waiting[];
  readonly risksOn: readonly Risk[];
  readonly alsoOpen: readonly Question[];
  readonly vote: Commitment | null;
  readonly low: boolean;
  readonly work: readonly WorkItem[];
  readonly onPath: readonly WorkItem[];
  readonly left: readonly WorkItem[];
  readonly started: boolean;
  readonly steps: readonly StepChange[];
  readonly connections: Connections;
}

const ROUTE = new Set(['via', 'to', 'from']);
const CHANGED = new Set(['added', 'modified', 'removed', 'deprecated']);
const LOW = 3;
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const KINDS: Readonly<Record<string, StepKind>> = {
  added: 'new',
  removed: 'removed',
  deprecated: 'removed',
};

function kindOf(model: Model, id: string, status: string): StepKind {
  if (status !== 'modified') return KINDS[status] ?? 'removed';
  const touched = model.diff(id).some((d) => d.prop !== null && ROUTE.has(d.prop));
  return touched ? 'rerouted' : 'differently';
}

const endpoint = (step: unknown, key: string): string | null => {
  const value = text(prop(step, key));
  return value === '' ? null : value;
};

const isOutsideService = (id: string | null, mine: ReadonlySet<string>): id is string =>
  id !== null && id.startsWith('svc:') && !mine.has(id);

function stepOf(model: Model, mine: ReadonlySet<string>, id: string): StepChange | null {
  const status = model.status(id);
  const step = model.get(id);
  if (status === null || !CHANGED.has(status) || step === undefined) return null;
  const kind = kindOf(model, id, status);
  const from = endpoint(step, 'from');
  const to = endpoint(step, 'to');
  const via = endpoint(step, 'via');
  const caller = isOutsideService(from, mine) ? from : null;
  const reachesUs = to !== null && mine.has(to);
  const sameCall = kind === 'differently' && caller !== null && reachesUs && via !== null;
  const action = plainLine(endpoint(step, 'action') ?? id);
  return { flow: id.split('#')[0] ?? id, id, kind, action, from, to, via, caller, sameCall };
}

/** The team's steps the plan touches. A step into the team's service whose route is unchanged but whose logic changed is "works differently". */
function stepsFor(
  model: Model,
  services: readonly string[],
  stepIds: readonly string[],
): StepChange[] {
  const mine = new Set(services);
  return stepIds.flatMap((id) => stepOf(model, mine, id) ?? []);
}

const ownsChange =
  (model: Model, team: string, cutChanges: readonly string[]) =>
  (change: string): boolean => {
    const builders = (model.plan.work_items ?? []).filter((w) => w.implements.includes(change));
    return builders.length > 0
      ? builders.some((w) => w.team === team)
      : cutChanges.includes(change);
  };

/** Whether something a gate holds up is this team's own: its work item, a change its work builds, a step it acts in. */
function owner(model: Model, team: string, cut: ReturnType<Model['teamCut']>) {
  const change = ownsChange(model, team, cut.changes);
  return (id: string): boolean => {
    if (id.startsWith('wi:')) return prop(model.get(id), 'team') === team;
    if (id.startsWith('chg:')) return change(id);
    return (
      id.startsWith('flow:') &&
      id.includes('#') &&
      cut.steps.includes(id) &&
      model.teamsOf(id).includes(team)
    );
  };
}

const stillOpen = (q: Question): boolean => q.status !== 'resolved';

/** Everything the page says about one team, derived once. */
export function teamPart(model: Model, team: string): TeamPart {
  const stage = planStage(model);
  const cut = model.teamCut(team);
  const services = model.toBe.services.filter((s) => s.team === team).map((s) => s.id);
  const owns = owner(model, team, cut);
  const gates = gatesOf(model);
  const decides = gates.filter((e) => e.decider === team);
  const waitsOn = gates
    .filter((e) => e.decider !== team)
    .map((gate) => ({ gate, held: heldUp(model, gate.id).filter(owns) }))
    .filter((w) => w.held.length > 0);
  const proposed = (r: Risk): boolean =>
    r.accepted_by !== undefined && prop(model.get(r.accepted_by), 'status') !== 'accepted';
  const risksOn = (model.plan.risks ?? []).filter(
    (r) => r.owner === team && r.roam === 'accepted' && proposed(r),
  );
  const alsoOpen = (model.plan.questions ?? []).filter(
    (q) => q.decider === team && stillOpen(q) && !gates.some((g) => g.id === q.id),
  );
  const { votes, teams } = voteSummary(model);
  const vote = teams.includes(team) ? (votes.get(team) ?? { team }) : null;
  const work = workOrdered(model, (w) => w.team === team);
  const critical = criticalSet(model);
  const states = work.map((w) => wiState(model, w.id));
  return {
    stage,
    services,
    changes: cut.changes,
    tests: cut.tests,
    decides,
    waitsOn,
    risksOn,
    alsoOpen,
    vote,
    low: (vote?.confidence ?? LOW) < LOW && !isApproved(stage),
    work,
    onPath: work.filter((w) => critical.has(w.id)),
    left: work.filter(
      (_, i) => states[i] !== undefined && states[i] !== 'done' && states[i] !== null,
    ),
    started: states.some((s: WorkState | null) => s !== null),
    steps: stepsFor(model, services, cut.steps),
    connections: connections(model, services),
  };
}

/** Changes to the team's things that no step shows (a record field, a contract). */
export function otherChanges(model: Model, p: TeamPart): string[] {
  const shown = new Set(p.steps.flatMap((s) => model.inverse(s.id).changes));
  return p.changes.filter((c) => !shown.has(c));
}
