import 'server-only';
import { pathIn, entryAt, readBytesIfAny } from '@/infrastructure/disk';

import { readExplorerCatalogue } from './service-explorer-catalogue';
import { workspaceFolder } from './workspace-folders';

// A corpus publication lives in <workspace>/explorer/corpus/<generation>/, and the browser fetches its files from
// /explorer-data/<workspace>/<generation>/<file>, read from there on request.

export const EXPLORER_ASSET =
  /^(?:(?:page-|pack-|index-|manifest-)[a-z0-9-]+|catalogue|refinement)\.json$/u;
const GENERATION = /^[a-f\d]{64}$/u;

/** One file of the workspace's installed publication, or null when it is not one. */
export async function readExplorerAsset(
  workspace: string,
  generation: string,
  file: string,
): Promise<Buffer | null> {
  if (!EXPLORER_ASSET.test(file) || !GENERATION.test(generation)) return null;
  const catalogue = await readExplorerCatalogue(workspace);
  if (catalogue === null || (catalogue.publication ?? catalogue.snapshot) !== generation) {
    return null;
  }
  const folder = await workspaceFolder(workspace);
  if (folder === null) return null;
  const target = pathIn(folder, 'explorer', 'corpus', generation, file);
  const entry = await entryAt(target).catch(() => null);
  if (entry === null || !entry.isFile() || entry.isSymbolicLink()) return null;
  return readBytesIfAny(target);
}
