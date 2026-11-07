import 'server-only';

import type { ModelIndex } from '@/application/model-index';
import { modelPlanRowsOf } from '@/application/model-plan-index';
import { modelPlanProgressOf } from '@/application/model-progress';
import { modelProgrammeRowsOf } from '@/application/model-workspace-work';
import type { ProgrammeRowVM } from '@/application/workspace-work/programme-page';

import { modelPlanCheckOf } from './model-plan-lock';
import { readModelWorkspaceWork } from './model-workspace-work';
import { readPlanLock } from './plan-lock';

/** Lists use authored metadata, lifecycle and independent progress, without composing full after models. */
export async function readModelPlanRows(
  index: ModelIndex,
  root?: string,
): Promise<
  ReturnType<typeof modelPlanRowsOf> & { readonly programmes: readonly ProgrammeRowVM[] }
> {
  const id = index.model.id;
  const entries = await readModelWorkspaceWork(id, root);
  const rows = await Promise.all(
    entries.map(async (entry) => {
      const lock = await readPlanLock(id, entry.slug, root);
      return {
        ...entry,
        progress: entry.progress ?? modelPlanProgressOf({ progress: { events: [] }, errors: [] }),
        base: {
          mode: entry.landed === true ? ('landed' as const) : ('live' as const),
          ...modelPlanCheckOf(lock, entry.plan),
        },
      };
    }),
  );
  return { ...modelPlanRowsOf(index, rows), programmes: modelProgrammeRowsOf(index, entries) };
}
