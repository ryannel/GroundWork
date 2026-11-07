// The representative native routes complement the complete frozen route union.
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanEntries, readModelPlanRevisions } from '@/infrastructure/model-plans';

import { selectedModelRoutes } from './model-routes';

export async function selectedRoutes(id: string): Promise<readonly string[]> {
  const index = await readCanonicalModelIndex(id);
  if (index === null) throw new Error(`Cannot select routes for ${id}: select a native workspace.`);
  const plans = await readModelPlanEntries(id);
  const revisions = new Map(
    await Promise.all(
      plans.map(async ({ slug }) => {
        const snapshots = await readModelPlanRevisions(id, slug);
        return [slug, snapshots.map((revision) => revision.version)] as const;
      }),
    ),
  );
  return selectedModelRoutes(index, plans, revisions);
}
