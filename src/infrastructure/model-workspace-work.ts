import 'server-only';

import { modelPlanProgressOf } from '@/application/model-progress';
import type { ModelWorkPlan } from '@/application/model-workspace-work';

import { readModelPlanBaseMarkers } from './model-plan-base';
import { readModelPlanProgress } from './model-plan-context';
import { readModelPlanEntries } from './model-plans';

/** Work pages load independent progress and cheap lifecycle markers, never project a plan's after model. */
export async function readModelWorkspaceWork(
  id: string,
  root?: string,
): Promise<readonly ModelWorkPlan[]> {
  const [entries, markers] = await Promise.all([
    readModelPlanEntries(id, root),
    readModelPlanBaseMarkers(id, root),
  ]);
  return Promise.all(
    entries.map(async (entry) => {
      const progress = await readModelPlanProgress(id, entry.slug, root);
      return {
        ...entry,
        landed: markers.has(entry.plan.meta.id),
        progress: progress === null ? null : modelPlanProgressOf(progress),
      };
    }),
  );
}
