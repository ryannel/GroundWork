import 'server-only';

import {
  modelPlanOutline,
  type ModelPlanProgress,
  type ModelPlanBasis,
  type ModelPlanSnapshot,
} from '@/application/model-plan-pages';
import { modelPlanProgressOf } from '@/application/model-progress';
import type { ModelQueryContext } from '@/application/model-reader';
import type { PlanCard } from '@/application/plan-footprint';
import { planHref, type Outline, type PlanAddress } from '@/application/plan-navigation';
import { inheritedPlanOrder } from '@/application/plans-index';

import { readModelPlanBaseMarkers } from './model-plan-base';
import { readModelPlanProgress, readSelectedPlanContext } from './model-plan-context';
import { readModelPlanBaseInfo } from './model-plan-lock';
import { readModelPlanEntries, readModelPlanRevisions } from './model-plans';

export interface ModelPlanData {
  readonly workspaceName: string;
  readonly context: ModelQueryContext;
  readonly outline: Outline;
  readonly plans: readonly PlanCard[];
  readonly progress: ModelPlanProgress;
  readonly snapshots: readonly ModelPlanSnapshot[];
  readonly basis: ModelPlanBasis | null;
}
export interface ModelPlanParams {
  readonly workspace: string;
  readonly plan: string;
}
/** Selected canonical projection and independent plan metadata. */
export async function modelPlanData(
  at: PlanAddress,
  versions = false,
): Promise<ModelPlanData | null> {
  const projection = await readSelectedPlanContext(at.workspace, at.slug);
  if (projection === null) return null;
  const baseContext: ModelQueryContext = {
    plan: projection.plan,
    profile: null,
    beforeIndex: projection.beforeIndex,
    afterIndex: projection.afterIndex,
  };
  const [entries, progress, snapshots, base, markers] = await Promise.all([
    readModelPlanEntries(at.workspace),
    readModelPlanProgress(at.workspace, at.slug),
    versions ? readModelPlanRevisions(at.workspace, at.slug) : Promise.resolve([]),
    readModelPlanBaseInfo(at.workspace, at.slug),
    readModelPlanBaseMarkers(at.workspace),
  ]);
  const actualProgress = modelPlanProgressOf(progress ?? { progress: { events: [] }, errors: [] });
  const context: ModelQueryContext = { ...baseContext, progress: actualProgress };
  const statuses = {
    draft: 'Draft',
    review: 'In review',
    approved: 'Approved',
    committed: 'Committed',
  } as const;
  return {
    workspaceName: projection.before.name,
    context,
    outline: modelPlanOutline(context, at),
    plans: entries.map(({ slug, plan }) => ({
      id: slug,
      title: plan.meta.title,
      href: planHref({ workspace: at.workspace, slug }),
      stage: statuses[plan.meta.status ?? 'draft'],
    })),
    progress: actualProgress,
    snapshots,
    basis:
      base === null
        ? null
        : {
            base,
            readsAfter: (base.mode === 'landed'
              ? []
              : inheritedPlanOrder(
                  projection.plan,
                  new Map(entries.map(({ plan }) => [plan.meta.id, plan])),
                  new Set(markers.keys()),
                )
            ).map((ancestor) => {
              const entry = entries.find(({ plan }) => plan.meta.id === ancestor.meta.id);
              return {
                id: ancestor.meta.id,
                title: ancestor.meta.title,
                href: planHref({ workspace: at.workspace, slug: entry?.slug ?? ancestor.meta.id }),
                stage: statuses[ancestor.meta.status ?? 'draft'],
              };
            }),
          },
  };
}
