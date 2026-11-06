import 'server-only';

import { parse } from 'yaml';

import type { ModelPlan } from '@/domain/workspace-model';
import { listFolder, pathIn, readTextIfAny } from '@/infrastructure/disk';

import { modelValidator } from './model-schema';
import { workspaceFolder } from './workspace-folders';

/** Canonical overlays stay separate from today's model and use the schema's generated type. */
export async function readModelPlans(id: string, root?: string): Promise<readonly ModelPlan[]> {
  const folder = await workspaceFolder(id, root);
  if (folder === null) return [];
  const plans = pathIn(folder, 'plans');
  const entries = await listFolder(plans);
  const check = await modelValidator('plan', 'document');
  const read = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const file = pathIn(plans, entry.name, 'plan.yaml');
        const text = await readTextIfAny(file);
        if (text === null) return [];
        const value: unknown = parse(text);
        if (!check(value)) throw new Error(`${file}: ${JSON.stringify(check.errors)}`);
        return [value];
      }),
  );
  return read.flat().toSorted((a, b) => a.meta.id.localeCompare(b.meta.id));
}
