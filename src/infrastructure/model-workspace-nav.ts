import 'server-only';

import type { ModelIndex } from '@/application/model-index';
import { modelWorkspaceNavOf, type ModelNavHere } from '@/application/model-navigation';
import type { NavGroup } from '@/application/workspace-nav';

import { readModelPlans } from './model-plans';

/** Native route navigation reads overlay metadata without reconstructing a legacy workspace. */
export async function readModelWorkspaceNav(
  index: ModelIndex,
  here: ModelNavHere = {},
): Promise<readonly NavGroup[]> {
  return modelWorkspaceNavOf(index, await readModelPlans(index.model.id), here);
}
