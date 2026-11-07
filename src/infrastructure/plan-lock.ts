import 'server-only';

import { z } from 'zod';

import type { StackHashes } from '@/application/plan/plan-stack';
import { pathIn, readTextIfAny } from '@/infrastructure/disk';

import { workspaceFolder } from './workspace-folders';

export const NATIVE_PLAN_LOCK_FORMAT = 'groundwork-model-lock/v1';

export interface PlanLock extends StackHashes {
  readonly format?: typeof NATIVE_PLAN_LOCK_FORMAT;
  readonly checkedOn: string;
  readonly entities: Readonly<Record<string, string>>;
  /** The hash of what the plans below this one added and changed; null before stacking was locked. */
  readonly composed: string | null;
  /** The hash of the plan.yaml that was checked; null when the lock predates recording it. */
  readonly plan: string | null;
}

const lockFile = z.strictObject({
  format: z.literal(NATIVE_PLAN_LOCK_FORMAT).optional(),
  checked_on: z.string(),
  entities: z.record(z.string(), z.string()),
  bases: z.record(z.string(), z.string()).optional(),
  programme: z.strictObject({ id: z.string(), hash: z.string() }).nullable().optional(),
  composed: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
});

/** The lock beside a plan; null when it has never been checked against today. */
export async function readPlanLock(
  workspace: string,
  slug: string,
  root?: string,
): Promise<PlanLock | null> {
  const folder = await workspaceFolder(workspace, root);
  if (folder === null) return null;
  const file = pathIn(folder, 'plans', slug, 'base.lock.json');
  const text = await readTextIfAny(file);
  if (text === null) return null;
  const result = lockFile.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  const { data } = result;
  return {
    ...(data.format === undefined ? {} : { format: data.format }),
    checkedOn: data.checked_on,
    entities: data.entities,
    bases: data.bases ?? {},
    programme: data.programme ?? null,
    composed: data.composed ?? null,
    plan: data.plan ?? null,
  };
}
