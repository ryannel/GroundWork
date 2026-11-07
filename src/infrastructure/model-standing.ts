import 'server-only';

import {
  modelStandingOf,
  modelStandingScopes,
  type ModelPlanStanding,
} from '@/application/model-plan-standing';
import { modelPlanProgressOf, type ModelPlanProgress } from '@/application/model-progress';
import { checkProgress } from '@/application/plan/progress';

import { readCanonicalModelIndex } from './model-index';
import { readModelPlanProgress, readSelectedPlanContext } from './model-plan-context';
import { readModelPlanEntries } from './model-plans';
import { readProgress } from './progress-store';

export interface ModelStandingResult {
  readonly standing: ModelPlanStanding;
  readonly progress: ModelPlanProgress;
  readonly problems: readonly { readonly path: string; readonly message: string }[];
}
/** Read only the neighbour progress files explicitly named by metadata; never derive a legacy plan. */
export async function readModelStanding(
  workspace: string,
  slug: string,
  root?: string,
): Promise<ModelStandingResult | null> {
  const current = await readCanonicalModelIndex(workspace, root);
  if (current === null) return null;
  const selected = await readSelectedPlanContext(workspace, slug, root);
  if (selected === null) throw new Error(`No native plan ${slug} in ${workspace}.`);
  const progress = await readModelPlanProgress(workspace, slug, root);
  if (progress === null) throw new Error(`The progress for native plan ${slug} cannot be read.`);
  const scopes = new Set(modelStandingScopes(selected.plan));
  const listed = await readModelPlanEntries(workspace, root);
  const entries = listed.filter((entry) => scopes.has(entry.slug));
  const readings = await Promise.all(
    entries.map(async (entry) => ({
      scope: entry.slug,
      plan: entry.plan,
      ...(await readProgress(workspace, entry.slug, root)),
    })),
  );
  const problems = [
    ...progress.errors,
    ...checkProgress(selected.plan, progress.progress),
    ...readings.flatMap((reading) =>
      [...reading.errors, ...checkProgress(reading.plan, reading.progress)].map((issue) => ({
        ...issue,
        path: `${reading.scope}/${issue.path}`,
      })),
    ),
  ];
  return {
    standing: modelStandingOf(selected.plan, progress.progress, current, readings),
    progress: modelPlanProgressOf(progress),
    problems,
  };
}
