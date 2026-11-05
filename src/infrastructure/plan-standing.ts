import 'server-only';

import { isRecord, prop, qualifiedOf } from '@/application/plan/ids';
import {
  originsOf,
  realisationOf,
  type TodayModel,
  todayModelOf,
} from '@/application/plan/realisation';
import {
  type CommitmentState,
  commitmentsOf,
  type Elsewhere,
  type PlanStanding,
  type PlanWork,
  type StandingTeam,
  standingOf,
} from '@/application/plan/work-standing';
import type { Neighbours } from '@/domain/plan/plan-neighbours';
import type { Plan, Progress } from '@/domain/plan/plan.generated';

import { readNeighbourIndex, readPlanRaw, readProgress } from './plan-store';
import { readToday } from './today-model';
import { untilEdited } from './workspace-memo';

// Where a plan's work stands (from its progress.yaml and those of the plans it depends on) and how far today
// says what its changes said (against the workspace's model of today, never the base a stacked plan reads).

interface Workspace {
  readonly teams: readonly StandingTeam[];
  readonly today: TodayModel | null;
}

const workspaces = untilEdited<Workspace>();

/** The workspace's teams, partners marked, and its today as realisation reads it; read once until a file changes. */
async function workspaceOf(workspace: string, root: string | undefined): Promise<Workspace> {
  return workspaces(root, `standing\n${workspace}`, async () => {
    const found = await readToday(workspace, root);
    if (found === null) return { teams: [], today: null };
    const teams = found.workspace.teams.map((team) => ({
      id: team.id,
      name: team.name,
      partner: team.partner === true,
    }));
    const { plan, attribution, model } = found.today;
    const today = todayModelOf({
      system: plan,
      origins: originsOf(attribution),
      ownerTeam: model.ownerTeam,
      partners: teams.filter((team) => team.partner).map((team) => team.id),
    });
    return { teams, today };
  });
}

const recordsIn = (value: unknown): readonly Readonly<Record<string, unknown>>[] =>
  Array.isArray(value) ? value.filter((item) => isRecord(item)) : [];

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** The work items and milestones of a plan as written, with what each is called. */
function workOf(raw: unknown): {
  readonly work: PlanWork;
  readonly labels: Readonly<Record<string, string>>;
} {
  const items = recordsIn(prop(raw, 'work_items')).flatMap((item) => {
    const id = text(item.id);
    const milestone = text(item.milestone);
    return id === null ? [] : [{ id, ...(milestone === null ? {} : { milestone }) }];
  });
  const milestones = recordsIn(prop(raw, 'milestones')).flatMap((m) => {
    const id = text(m.id);
    return id === null ? [] : [{ id }];
  });
  const labels = [
    ...recordsIn(prop(raw, 'work_items')),
    ...recordsIn(prop(raw, 'milestones')),
  ].flatMap((each) => {
    const id = text(each.id);
    const label = text(each.title) ?? text(each.name);
    return id === null || label === null ? [] : [[id, label] as const];
  });
  return { work: { work_items: items, milestones }, labels: Object.fromEntries(labels) };
}

/** Every id in another plan or programme a plan's work waits on. */
function qualifiedIn(plan: Plan): readonly string[] {
  const ids = [
    ...(plan.work_items ?? []).flatMap((w) => [...(w.depends_on ?? []), ...(w.blocked_by ?? [])]),
    ...(plan.milestones ?? []).flatMap((m) => m.after ?? []),
  ];
  return [...new Set(ids.filter((id) => qualifiedOf(id) !== null))];
}

/** What the plans and programmes a plan's work waits on say about the ids it names in them. */
async function elsewhereOf(
  plan: Plan,
  at: { readonly workspace: string; readonly root: string | undefined },
): Promise<Elsewhere> {
  const ids = qualifiedIn(plan);
  if (ids.length === 0) return { commitments: {}, statuses: {}, labels: {} };
  const neighbours = await readNeighbourIndex(at.workspace, at.root);
  const scopes = [...new Set(ids.flatMap((id) => qualifiedOf(id)?.scope ?? []))].filter((scope) =>
    neighbours.plans.has(scope),
  );
  const read = await Promise.all(
    scopes.map(async (scope) => {
      const [raw, progress] = await Promise.all([
        readPlanRaw(at.workspace, scope, at.root),
        readProgress(at.workspace, scope, at.root),
      ]);
      const { work, labels } = workOf(raw);
      const states = commitmentsOf(work, progress.progress);
      return { scope, states, labels };
    }),
  );
  return gathered(ids, read, neighbours);
}

interface ReadPlan {
  readonly scope: string;
  readonly states: Readonly<Record<string, CommitmentState | null>>;
  readonly labels: Readonly<Record<string, string>>;
}

/** What one qualified id is in the plan or programme it names: its commitment, status and label, where known. */
function lookUp(id: string, read: readonly ReadPlan[], neighbours: Omit<Neighbours, 'slug'>) {
  const qualified = qualifiedOf(id);
  const scope = qualified?.scope ?? '';
  const inner = qualified?.id ?? id;
  const found = read.find((each) => each.scope === scope);
  const where = neighbours.plans.get(scope) ?? neighbours.programmes.get(scope);
  return {
    commitment:
      found !== undefined && inner in found.states ? (found.states[inner] ?? null) : undefined,
    label: found?.labels[inner],
    status: where?.ids.get(inner),
  };
}

/** Each qualified id's commitment, status and label, as far as the plans and programmes read say. */
function gathered(
  ids: readonly string[],
  read: readonly ReadPlan[],
  neighbours: Omit<Neighbours, 'slug'>,
): Elsewhere {
  const commitments: Record<string, CommitmentState | null> = {};
  const labels: Record<string, string> = {};
  const statuses: Record<string, string | null> = {};
  for (const id of ids) {
    const { commitment, label, status } = lookUp(id, read, neighbours);
    if (commitment !== undefined) commitments[id] = commitment;
    if (label !== undefined) labels[id] = label;
    if (status !== undefined) statuses[id] = status;
  }
  return { commitments, statuses, labels };
}

/** Where a plan's work stands, and how far today says what its changes said. */
export async function readStanding(
  plan: Plan,
  progress: Progress,
  at: { readonly workspace: string; readonly root: string | undefined },
): Promise<PlanStanding> {
  const [{ teams, today }, elsewhere] = await Promise.all([
    workspaceOf(at.workspace, at.root),
    elsewhereOf(plan, at),
  ]);
  return {
    ...standingOf(plan, progress, { teams, elsewhere }),
    changes: today === null ? [] : realisationOf(plan, today),
  };
}
