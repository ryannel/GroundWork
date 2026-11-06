import 'server-only';

import { parse } from 'yaml';

import { modelRecord, type WorkspaceModel } from '@/domain/workspace-model';
import { pathIn, readText } from '@/infrastructure/disk';

import { readModel } from './read-model';
import { workspaceFolders } from './workspace-folders';

/** Select the canonical reader by the authored format; legacy workspaces keep their existing reader. */
export async function readModelIfCanonical(
  id: string,
  root?: string,
): Promise<WorkspaceModel | null> {
  const folders = await workspaceFolders(root);
  const folder = folders.get(id);
  if (folder === undefined) return null;
  const document: unknown = parse(await readText(pathIn(folder, 'workspace.yaml')));
  return modelRecord(document)?.format === 2 ? readModel(id, root) : null;
}
