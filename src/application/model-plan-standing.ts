import { qualifyId, qualifiedOf, stripPrefix } from '@/domain/ids';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import type { ModelIndex } from './model-index';
import { modelRealisationOf, type ModelChangeRealisation } from './model-realisation';
import {
  commitmentsOf,
  standingOf,
  type Elsewhere,
  type PlanStanding,
  type StandingPlan,
  type StandingProgress,
  type StandingContext,
} from './plan/work-standing';

export interface ModelStandingRead {
  readonly scope: string;
  readonly plan: StandingPlan;
  readonly progress: StandingProgress;
}
export interface ModelPlanStanding extends Omit<PlanStanding, 'changes'> {
  readonly changes: readonly ModelChangeRealisation[];
}
/** Only explicit qualified metadata references request another plan's progress record. */
export function modelStandingScopes(plan: ModelPlan): readonly string[] {
  const refs = [
    ...(plan.work_items ?? []).flatMap((item) => [
      ...(item.depends_on ?? []),
      ...(item.blocked_by ?? []),
    ]),
    ...(plan.milestones ?? []).flatMap((milestone) => milestone.after ?? []),
  ];
  return [...new Set(refs.flatMap((id) => qualifiedOf(id)?.scope ?? []))];
}
interface MetadataLabels {
  readonly work_items?: readonly { readonly id: string; readonly title: string }[];
  readonly milestones?: readonly { readonly id: string; readonly name: string }[];
  readonly decisions?: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
  readonly questions?: readonly {
    readonly id: string;
    readonly question: string;
    readonly status: string;
    readonly answered_by?: string;
  }[];
}
function questionState(plan: MetadataLabels, id: string): string | null {
  const question = plan.questions?.find((item) => item.id === id);
  if (question === undefined) return null;
  return plan.decisions?.some(
    (item) => item.id === question.answered_by && item.status === 'accepted',
  ) === true
    ? 'resolved'
    : question.status;
}
function metadataEntries(
  plan: MetadataLabels,
): readonly { readonly id: string; readonly label: string; readonly status: string | null }[] {
  return [
    ...(plan.work_items ?? []).map((item) => ({ id: item.id, label: item.title, status: null })),
    ...(plan.milestones ?? []).map((item) => ({ id: item.id, label: item.name, status: null })),
    ...(plan.decisions ?? []).map((item) => ({
      id: item.id,
      label: item.title,
      status: item.status,
    })),
    ...(plan.questions ?? []).map((item) => ({
      id: item.id,
      label: item.question,
      status: questionState(plan, item.id),
    })),
  ];
}
function elsewhereOf(
  readings: readonly ModelStandingRead[],
  programmes: WorkspaceModel['programmes'],
): Elsewhere {
  const states = readings.flatMap((reading) =>
    Object.entries(commitmentsOf(reading.plan, reading.progress)).map(
      ([id, value]) => [qualifyId(reading.scope, id), value] as const,
    ),
  );
  const planMetadata = readings.flatMap((reading) =>
    metadataEntries(reading.plan).map((entry) => ({ scope: reading.scope, ...entry })),
  );
  const programmeMetadata = programmes.flatMap((programme) =>
    metadataEntries(programme).map((entry) => ({
      scope: stripPrefix(programme.id, 'prog'),
      ...entry,
    })),
  );
  const all = [...planMetadata, ...programmeMetadata];
  return {
    commitments: Object.fromEntries(states),
    statuses: Object.fromEntries(
      all.map((entry) => [qualifyId(entry.scope, entry.id), entry.status]),
    ),
    labels: Object.fromEntries(all.map((entry) => [qualifyId(entry.scope, entry.id), entry.label])),
  };
}
/** Cheap native metadata context: no overlays or current-fact realisation are computed. */
export function modelStandingContextOf(
  model: Pick<WorkspaceModel, 'teams' | 'programmes'>,
  readings: readonly ModelStandingRead[] = [],
): StandingContext {
  const teams = (model.teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    partner: team.partner === true,
  }));
  return { teams, elsewhere: elsewhereOf(readings, model.programmes) };
}
/** Metadata standing and current-fact agreement remain separate from the selected plan's proposed model. */
export function modelStandingOf(
  plan: ModelPlan,
  progress: StandingProgress,
  index: ModelIndex,
  readings: readonly ModelStandingRead[] = [],
): ModelPlanStanding {
  return {
    ...standingOf(plan, progress, modelStandingContextOf(index.model, readings)),
    changes: modelRealisationOf(plan, index),
  };
}
