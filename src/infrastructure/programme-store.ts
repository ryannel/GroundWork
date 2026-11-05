import 'server-only';

import path from 'node:path';

import { parse } from 'yaml';

import type { Issue } from '@/application/plan/check-context';
import { pathIn, listFolder, readTextIfAny } from '@/infrastructure/disk';

import { workspaceFolder } from './workspace-folders';

// <workspace>/programmes/<id>/programme.yaml   the outcome some plans serve and the context they share
// A workspace no folder holds has no programmes: its programmes folder is a path that is not there.
async function programmesFolder(workspace: string, root: string | undefined): Promise<string> {
  const folder = await workspaceFolder(workspace, root);
  return pathIn(folder ?? pathIn(root ?? '', '.no-such-workspace', workspace), 'programmes');
}

/** The ids of a workspace's programmes: the folders under programmes/ that hold a programme.yaml. */
export async function listProgrammes(workspace: string, root?: string): Promise<string[]> {
  const folder = await programmesFolder(workspace, root);
  const entries = await listFolder(folder);
  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const held = await Promise.all(
    ids.map(async (id) => (await readTextIfAny(pathIn(folder, id, 'programme.yaml'))) !== null),
  );
  return ids.filter((_, i) => held[i] === true).toSorted((a, b) => a.localeCompare(b));
}

/** programmes/<id>/programme.yaml as written, or why it cannot be read as YAML. */
export async function readProgrammeRaw(
  workspace: string,
  id: string,
  root?: string,
): Promise<{ readonly data: unknown } | { readonly error: Issue }> {
  const file = pathIn(await programmesFolder(workspace, root), path.basename(id), 'programme.yaml');
  try {
    return {
      data: parse((await readTextIfAny(file)) ?? '', { prettyErrors: true, uniqueKeys: true }),
    };
  } catch (error) {
    return {
      error: { path: '(root)', message: error instanceof Error ? error.message : String(error) },
    };
  }
}
