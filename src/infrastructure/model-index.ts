import 'server-only';

import { indexOf, type ModelIndex } from '@/application/model-index';
import type { WorkspaceModel } from '@/domain/workspace-model';

import { readModelIfCanonical } from './canonical-model';
import { readModel } from './read-model';

const indexes = new WeakMap<WorkspaceModel, ModelIndex>();

/** Share one index for the exact file-watched model, without a second freshness policy. */
export async function readModelIndex(id: string, root?: string): Promise<ModelIndex | null> {
  const model = await readModel(id, root);
  return model === null ? null : indexed(model);
}

function indexed(model: WorkspaceModel): ModelIndex {
  const known = indexes.get(model);
  if (known !== undefined) return known;
  const index = indexOf(model);
  indexes.set(model, index);
  return index;
}

/** Transitional format selection; native consumers still share the canonical reader and index. */
export async function readCanonicalModelIndex(
  id: string,
  root?: string,
): Promise<ModelIndex | null> {
  const model = await readModelIfCanonical(id, root);
  return model === null ? null : indexed(model);
}
