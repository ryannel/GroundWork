import 'server-only';

import type { Issue } from '@/application/plan/check-context';
import type { Progress } from '@/domain/plan/plan.generated';
import { pathIn, readTextIfAny } from '@/infrastructure/disk';

import { defProblems, planDef } from './plan-schema';
import { planFolder, readRaw } from './plan-yaml';

/** What reading a plan's progress.yaml found: the record, or why it cannot be read. */
export interface ProgressRead {
  readonly progress: Progress;
  readonly errors: readonly Issue[];
}

const NO_PROGRESS: Progress = { events: [] };

/** plans/<slug>/progress.yaml, checked against the schema; an empty record when the plan has none. */
export async function readProgress(
  workspace: string,
  slug: string,
  root?: string,
): Promise<ProgressRead> {
  const file = pathIn(await planFolder(root, workspace, slug), 'progress.yaml');
  if ((await readTextIfAny(file)) === null) return { progress: NO_PROGRESS, errors: [] };
  const raw = await readRaw(file);
  if ('error' in raw) return { progress: NO_PROGRESS, errors: [raw.error] };
  const check = await planDef<Progress>('progress');
  if (check(raw.data)) return { progress: raw.data, errors: [] };
  return {
    progress: NO_PROGRESS,
    errors: defProblems(check).map((message) => ({ path: '(root)', message })),
  };
}
