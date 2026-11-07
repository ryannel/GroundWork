import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { indexOf, type ModelIndex } from './model-index';
import type { ModelPlanProgress } from './model-progress';
import { evidenceTransportOf, type ModelTransportProfile } from './model-transport';
import type { IndexedPlan } from './plans-index';

/** The browser receives facts, independently of the server's query indexes. */
export interface ModelPlanPayload {
  readonly plan: ModelPlan;
  readonly before: WorkspaceModel;
  readonly after: WorkspaceModel;
  readonly profile?: ModelTransportProfile;
  readonly progress?: ModelPlanProgress;
}
export type ModelPayload =
  { readonly model: WorkspaceModel; readonly profile?: ModelTransportProfile } | ModelPlanPayload;
export interface ModelQueryContext {
  readonly plan: ModelPlan | null;
  readonly profile: ModelTransportProfile | null;
  readonly progress?: ModelPlanProgress | null;
  readonly beforeIndex: ModelIndex;
  readonly afterIndex: ModelIndex;
}

/** Keep before/after facts and proposal gaps intact across the server/browser boundary. */
export function selectedPlanPayload(
  context: IndexedPlan,
  lookup = 'evidence.json',
  progress?: ModelPlanProgress,
): ModelPlanPayload {
  const transport = evidenceTransportOf([context.before, context.after], [context.plan]);
  const before = transport.scope(context.before);
  const after = transport.scope(context.after);
  return {
    plan: context.plan,
    ...(progress === undefined ? {} : { progress }),
    before: before.model,
    after: after.model,
    profile: {
      kind: 'authored-evidence-closure',
      lookup,
      before: before.counts,
      after: after.counts,
    },
  };
}

/** The current authored view retains its referenced evidence and declares unloaded records. */
export function currentModelPayload(model: WorkspaceModel): ModelPayload {
  const scoped = evidenceTransportOf([model]).scope(model);
  return {
    model: scoped.model,
    profile: { kind: 'authored-evidence-closure', lookup: 'evidence.json', current: scoped.counts },
  };
}

/** Query the supplied models; the browser never reapplies an overlay. */
export function modelContextOf(payload: ModelPayload): ModelQueryContext {
  if ('model' in payload) {
    const current = indexOf(payload.model);
    return {
      plan: null,
      profile: payload.profile ?? null,
      beforeIndex: current,
      afterIndex: current,
    };
  }
  const beforeIndex = indexOf(payload.before);
  return {
    plan: payload.plan,
    profile: payload.profile ?? null,
    progress: payload.progress ?? null,
    beforeIndex,
    afterIndex: payload.after === payload.before ? beforeIndex : indexOf(payload.after),
  };
}
