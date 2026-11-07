import 'server-only';

import { parse } from 'yaml';

import { indexOf, type ModelIndex } from '@/application/model-index';
import type { ContractData } from '@/domain/model/contracts.generated';
import type { WorkspaceModel } from '@/domain/workspace-model';
import { pathIn, readTextIfAny } from '@/infrastructure/disk';

import { readModelPlanEntries, readModelPlanEntry } from './model-plans';
import { modelValidator } from './model-schema';
import { readModelFolder } from './read-model';
import { workspaceFolder } from './workspace-folders';
import { untilEdited } from './workspace-memo';

export type ModelPlanBaseMarker = ContractData<'workspace', 'PlanBaseMarker'>;
export interface FrozenModelBase {
  readonly marker: ModelPlanBaseMarker;
  readonly model: WorkspaceModel;
  readonly index: ModelIndex;
}
const markers = untilEdited<ReadonlyMap<string, ModelPlanBaseMarker>>();
const indexes = new WeakMap<WorkspaceModel, ModelIndex>();

/** A listed native plan's versioned marker; an older base format never falls back to today. */
async function readModelPlanBaseMarker(
  id: string,
  slug: string,
  root?: string,
): Promise<ModelPlanBaseMarker | null> {
  const entry = await readModelPlanEntry(id, slug, root);
  const folder = await workspaceFolder(id, root);
  if (entry === null || folder === null) return null;
  const file = pathIn(folder, 'plans', entry.slug, 'base.yaml');
  const text = await readTextIfAny(file);
  if (text === null) return null;
  const value: unknown = parse(text);
  const check = await modelValidator('workspace', 'PlanBaseMarker');
  if (!check(value)) throw new Error(`${file}: ${JSON.stringify(check.errors)}`);
  return value;
}

/** Landed identities are metadata; pages do not read every historical model. */
export async function readModelPlanBaseMarkers(
  id: string,
  root?: string,
): Promise<ReadonlyMap<string, ModelPlanBaseMarker>> {
  return markers(root, id, async () => {
    const entries = await readModelPlanEntries(id, root);
    const read = await Promise.all(
      entries.map(async (entry) => {
        const marker = await readModelPlanBaseMarker(id, entry.slug, root);
        return marker === null ? [] : [[entry.plan.meta.id, marker] as const];
      }),
    );
    return new Map(read.flat());
  });
}

/** The exact canonical inputs retained when this plan landed, with their own pins and gaps. */
export async function readModelPlanBase(
  id: string,
  slug: string,
  root?: string,
): Promise<FrozenModelBase | null> {
  const marker = await readModelPlanBaseMarker(id, slug, root);
  const folder = await workspaceFolder(id, root);
  if (marker === null || folder === null) return null;
  const model = await readModelFolder(pathIn(folder, 'plans', slug, 'base'), id);
  if (model.id !== id) throw new Error(`${slug}: frozen model belongs to another workspace.`);
  const index = indexes.get(model) ?? indexOf(model);
  indexes.set(model, index);
  return { marker, model, index };
}

/** Validation checks each frozen base as strict historical current facts. */
export async function readModelFrozenBases(
  id: string,
  root?: string,
): Promise<ReadonlyMap<string, WorkspaceModel>> {
  const entries = await readModelPlanEntries(id, root);
  const read = await Promise.all(
    entries.map(async (entry) => {
      const base = await readModelPlanBase(id, entry.slug, root);
      return base === null ? [] : [[entry.plan.meta.id, base.model] as const];
    }),
  );
  return new Map(read.flat());
}
