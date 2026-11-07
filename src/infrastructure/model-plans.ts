import 'server-only';

import { parse } from 'yaml';

import type { ModelPlan } from '@/domain/workspace-model';
import { listFolder, pathIn, readTextIfAny } from '@/infrastructure/disk';

import { modelValidator } from './model-schema';
import { workspaceFolder } from './workspace-folders';
import { untilEdited } from './workspace-memo';

export interface ModelPlanRevisionEntry {
  readonly version: string;
  readonly plan: ModelPlan;
}

export interface ModelPlanEntry {
  readonly slug: string;
  readonly plan: ModelPlan;
}

const remembered = untilEdited<readonly ModelPlanEntry[]>();
const revisions = untilEdited<readonly ModelPlanRevisionEntry[]>();

async function readDocument(file: string): Promise<ModelPlan | null> {
  const text = await readTextIfAny(file);
  if (text === null) return null;
  const value: unknown = parse(text);
  const check = await modelValidator('plan', 'document');
  if (!check(value)) throw new Error(`${file}: ${JSON.stringify(check.errors)}`);
  return value;
}

async function loadEntries(id: string, root?: string): Promise<readonly ModelPlanEntry[]> {
  const folder = await workspaceFolder(id, root);
  if (folder === null) return [];
  const plans = pathIn(folder, 'plans');
  const entries = await listFolder(plans);
  const read = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const file = pathIn(plans, entry.name, 'plan.yaml');
        const plan = await readDocument(file);
        return plan === null ? [] : [{ slug: entry.name, plan }];
      }),
  );
  return read.flat().toSorted((a, b) => a.plan.meta.id.localeCompare(b.plan.meta.id));
}

/** Canonical overlays retain their actual folder names, refreshed after authored edits. */
export async function readModelPlanEntries(
  id: string,
  root?: string,
): Promise<readonly ModelPlanEntry[]> {
  return remembered(root, id, async () => loadEntries(id, root));
}

/** A slug selects a listed directory; it is never interpreted as a filesystem path. */
export async function readModelPlanEntry(
  id: string,
  slug: string,
  root?: string,
): Promise<ModelPlanEntry | null> {
  const entries = await readModelPlanEntries(id, root);
  return entries.find((entry) => entry.slug === slug) ?? null;
}

/** Canonical overlays stay separate from today's model and use the schema's generated type. */
export async function readModelPlans(id: string, root?: string): Promise<readonly ModelPlan[]> {
  const entries = await readModelPlanEntries(id, root);
  return entries.map((entry) => entry.plan);
}

/** Actual snapshot filenames, checked against the same native overlay schema as the live plan. */
export async function readModelPlanRevisions(
  id: string,
  slug: string,
  root?: string,
): Promise<readonly ModelPlanRevisionEntry[]> {
  return revisions(root, `${id}/${slug}`, async () => {
    const selected = await readModelPlanEntry(id, slug, root);
    const workspace = await workspaceFolder(id, root);
    if (selected === null || workspace === null) return [];
    const folder = pathIn(workspace, 'plans', selected.slug, 'revisions');
    const entries = await listFolder(folder);
    const read = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
        .map(async (entry) => {
          const file = pathIn(folder, entry.name);
          const plan = await readDocument(file);
          if (plan === null) return [];
          if (plan.meta.id !== selected.plan.meta.id) {
            throw new Error(`${file}: revision identity differs from its containing plan.`);
          }
          return [{ version: entry.name.slice(0, -'.yaml'.length), plan }];
        }),
    );
    return read.flat().toSorted((a, b) => a.version.localeCompare(b.version));
  });
}
