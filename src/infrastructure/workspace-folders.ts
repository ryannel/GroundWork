import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

// Where each workspace's folder is. A workspace is its own repo, kept anywhere on disk; Groundwork reads:
//   GROUNDWORK_WORKSPACES   when set, only these workspace folders (path.delimiter between them): for CI and
//                           one-off builds, so a company's site carries no other workspace
//   otherwise               the bundled examples in workspaces/, and the workspace folders that
//                           groundwork.local.yaml lists (git-ignored, one per machine)
// Every listed folder must hold a workspace.yaml; one that does not is an error, never skipped. A workspace's id
// is the id in its workspace.yaml, whatever its folder is called.

const LOCAL = 'groundwork.local.yaml';
const BUNDLED = 'workspaces';

const localFile = z.strictObject({
  /** Workspace folders, relative to the Groundwork checkout or absolute. */
  workspaces: z.array(z.string()).default([]),
  /** Whether to read the examples in workspaces/ too. */
  bundled: z.boolean().default(true),
});

const idOnly = z.looseObject({ id: z.string() });

async function idOf(folder: string, listedIn: string): Promise<string> {
  const file = path.join(folder, 'workspace.yaml');
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null)
    throw new Error(`${folder}: listed in ${listedIn} but holds no workspace.yaml`);
  const result = idOnly.safeParse(parse(text));
  if (!result.success) throw new Error(`${file}: has no id`);
  return result.data.id;
}

async function childrenOf(container: string): Promise<string[]> {
  const entries = await readdir(container, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(container, entry.name))
    .toSorted((a, b) => a.localeCompare(b));
}

async function indexed(
  folders: readonly { folder: string; listedIn: string }[],
): Promise<ReadonlyMap<string, string>> {
  const read = await Promise.all(
    folders.map(async ({ folder, listedIn }) => ({ folder, id: await idOf(folder, listedIn) })),
  );
  const by = new Map<string, string>();
  for (const { id, folder } of read) {
    const seen = by.get(id);
    if (seen !== undefined) throw new Error(`workspace ${id}: found in both ${seen} and ${folder}`);
    by.set(id, folder);
  }
  return by;
}

async function bundledIn(container: string): Promise<{ folder: string; listedIn: string }[]> {
  const children = await childrenOf(container);
  return children.map((folder) => ({ folder, listedIn: container }));
}

/** What a Groundwork checkout at `home` reads, given GROUNDWORK_WORKSPACES and whether to read its local file. */
export async function registeredAt(
  home: string,
  options: { readonly env?: string | undefined; readonly local: boolean },
): Promise<ReadonlyMap<string, string>> {
  const { env } = options;
  if (env !== undefined && env.trim() !== '') {
    const folders = env
      .split(path.delimiter)
      .filter((each) => each.trim() !== '')
      .map((each) => ({ folder: path.resolve(home, each), listedIn: 'GROUNDWORK_WORKSPACES' }));
    return indexed(folders);
  }
  const text = options.local
    ? await readFile(path.join(home, LOCAL), 'utf8').catch(() => null)
    : null;
  const result = localFile.safeParse(text === null ? {} : (parse(text) ?? {}));
  if (!result.success) throw new Error(`${LOCAL}: ${result.error.message}`);
  const { workspaces, bundled } = result.data;
  return indexed([
    ...(bundled ? await bundledIn(path.join(home, BUNDLED)) : []),
    ...workspaces.map((each) => ({ folder: path.resolve(home, each), listedIn: LOCAL })),
  ]);
}

let known: Promise<ReadonlyMap<string, string>> | null = null;

/**
 * Every workspace's folder, by id. With `root`, a folder of workspace folders (tests and tools read one such
 * folder); without it, the workspaces this Groundwork is set up to read.
 */
export async function workspaceFolders(root?: string): Promise<ReadonlyMap<string, string>> {
  if (root !== undefined) return indexed(await bundledIn(root));
  // Tests read only the examples, whatever this machine has registered.
  known ??= registeredAt(process.cwd(), {
    env: process.env.GROUNDWORK_WORKSPACES,
    local: process.env.VITEST === undefined,
  });
  return known;
}

/** The folder of one workspace, or null when no workspace has that id. */
export async function workspaceFolder(id: string, root?: string): Promise<string | null> {
  const found = await workspaceFolders(root);
  return found.get(id) ?? null;
}
