import 'server-only';

import { type SystemModel, systemModelOf } from '@/application/workspace-model';
import { findWorkspace } from '@/application/workspace-paths';
import type { Workspace } from '@/domain/workspace';

import { untilEdited } from './workspace-memo';
import { readWorkspaceModel } from './workspace-model';
import { readWorkspaces } from './workspace-store';

export interface Today {
  readonly workspace: Workspace;
  /** How the workspace's systems work today, as a plan-shaped document and its Model. */
  readonly today: SystemModel;
}

const remembered = untilEdited<Today | null>();

/**
 * A workspace's model of today, read once for its pages and for the plans put onto it, until a file changes.
 * Null when there is no such workspace.
 */
export async function readToday(id: string, root?: string): Promise<Today | null> {
  return remembered(root, id, async () => {
    const workspace = findWorkspace(await readWorkspaces(root), id);
    if (workspace === null) return null;
    return {
      workspace,
      today: systemModelOf(workspace, await readWorkspaceModel(workspace, root)),
    };
  });
}
