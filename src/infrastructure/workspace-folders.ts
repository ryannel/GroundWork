import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

// Where each workspace's folder is. A workspace is its own repo, kept anywhere on disk; Groundwork reads:
//   GROUNDWORK_WORKSPACES   when set, only these workspace folders (path.delimiter between them): for CI and
//                           one-off builds, so a company's site carries no other workspace
//   otherwise               the bundled examples in workspaces/, and the workspaces that groundwork.local.yaml
//                           lists (git-ignored, one per machine): a folder on this machine, or a repo, which
//                           `npm run workspace -- pull` clones into .workspaces/<name>
// Every listed folder must hold a workspace.yaml; one that does not is an error, never skipped. A workspace's id
// is the id in its workspace.yaml, whatever its folder is called.

const LOCAL = 'groundwork.local.yaml';
const BUNDLED = 'workspaces';
/** Where workspaces linked by repo are cloned, inside the checkout and git-ignored. */
const CLONES = '.workspaces';

const linked = z.strictObject({
  /** A git URL or anything `git clone` takes. */
  repo: z.string().min(1),
  /** Where it is cloned; .workspaces/<repo name> when not given. */
  folder: z.string().min(1).optional(),
});

/** One workspace in the local file: a folder on this machine, or a repo cloned for it. */
export type LocalEntry = string | z.infer<typeof linked>;

const localFile = z.strictObject({
  /** Workspace folders, relative to the Groundwork checkout or absolute, or repos to clone. */
  workspaces: z.array(z.union([z.string().min(1), linked])).default([]),
  /** Whether to read the examples in workspaces/ too. */
  bundled: z.boolean().default(true),
});

/** The folder a repo's clone goes in: the last part of its URL, without .git. */
export function cloneFolder(repo: string): string {
  const name = repo
    .split(/[/:\\]/u)
    .findLast((part) => part !== '')
    ?.replace(/\.git$/u, '');
  if (name === undefined || name === '' || name === '.' || name === '..') {
    throw new Error(`${repo}: cannot tell what to call its folder; give it a folder`);
  }
  return path.join(CLONES, name);
}

/** Where an entry's workspace is, relative to the checkout or absolute. */
export function folderOf(entry: LocalEntry): string {
  if (typeof entry === 'string') return entry;
  return entry.folder ?? cloneFolder(entry.repo);
}

const idOnly = z.looseObject({ id: z.string() });

interface Listed {
  readonly folder: string;
  readonly listedIn: string;
  readonly repo?: string;
}

async function idOf({ folder, listedIn, repo }: Listed): Promise<string> {
  const file = path.join(folder, 'workspace.yaml');
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null && repo !== undefined) {
    throw new Error(
      `${repo}: listed in ${listedIn} but not cloned to ${folder}; run npm run workspace -- pull`,
    );
  }
  if (text === null) {
    throw new Error(`${folder}: listed in ${listedIn} but holds no workspace.yaml`);
  }
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

async function indexed(folders: readonly Listed[]): Promise<ReadonlyMap<string, string>> {
  const read = await Promise.all(
    folders.map(async (each) => ({ folder: each.folder, id: await idOf(each) })),
  );
  const by = new Map<string, string>();
  for (const { id, folder } of read) {
    const seen = by.get(id);
    if (seen !== undefined) throw new Error(`workspace ${id}: found in both ${seen} and ${folder}`);
    by.set(id, folder);
  }
  return by;
}

async function bundledIn(container: string): Promise<Listed[]> {
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
  const { workspaces, bundled } = options.local
    ? await readLocal(home)
    : { workspaces: [], bundled: true };
  return indexed([
    ...(bundled ? await bundledIn(path.join(home, BUNDLED)) : []),
    ...workspaces.map((each) => ({
      folder: path.resolve(home, folderOf(each)),
      listedIn: LOCAL,
      ...(typeof each === 'string' ? {} : { repo: each.repo }),
    })),
  ]);
}

/** The local file of the checkout at `home`, or its defaults when there is none. */
export async function readLocal(
  home: string,
): Promise<{ readonly workspaces: readonly LocalEntry[]; readonly bundled: boolean }> {
  const text = await readFile(path.join(home, LOCAL), 'utf8').catch(() => null);
  const result = localFile.safeParse(text === null ? {} : (parse(text) ?? {}));
  if (!result.success) throw new Error(`${LOCAL}: ${result.error.message}`);
  return result.data;
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
