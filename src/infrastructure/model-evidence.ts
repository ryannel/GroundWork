import 'server-only';

import type { ModelIndex } from '@/application/model-index';
import { modelInspectionOf, type ModelInspection } from '@/application/model-inspection';

import { readCanonicalModelIndex } from './model-index';
import { readSelectedPlanContext, readSelectedRevisionContext } from './model-plan-context';

export interface EvidenceScope {
  readonly plan: string;
  readonly version?: string;
}
async function scopedIndex(
  id: string,
  scope: EvidenceScope | undefined,
  root?: string,
): Promise<ModelIndex | null> {
  if (scope === undefined) return readCanonicalModelIndex(id, root);
  const context =
    scope.version === undefined
      ? await readSelectedPlanContext(id, scope.plan, root)
      : await readSelectedRevisionContext(id, scope.plan, scope.version, root);
  return context?.beforeIndex ?? null;
}

/** An explicitly requested historical scope never falls back to current evidence. */
export async function readModelEvidence(
  workspace: string,
  id: string,
  scope?: EvidenceScope,
  root?: string,
): Promise<ModelInspection | null> {
  const index = await scopedIndex(workspace, scope, root);
  if (index?.get(id)?.kind !== 'evidence') return null;
  return modelInspectionOf(
    { plan: null, profile: null, beforeIndex: index, afterIndex: index },
    id,
  );
}
