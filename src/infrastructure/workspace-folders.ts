import 'server-only';

import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

import { pathIn, resolvedFrom, listFolder, readTextIfAny } from '@/infrastructure/disk';

import { workspaceFile } from './workspace-schema';

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
  return pathIn(CLONES, name);
}

/** Where an entry's workspace is, relative to the checkout or absolute. */
export function folderOf(entry: LocalEntry): string {
  if (typeof entry === 'string') return entry;
  return entry.folder ?? cloneFolder(entry.repo);
}

const identity = z.looseObject({
  id: workspaceFile.shape.id,
  name: workspaceFile.shape.name,
});

interface Listed {
  readonly folder: string;
  readonly listedIn: string;
  readonly source: 'example' | 'local' | 'environment';
  readonly isExample: boolean;
  readonly repo?: string;
}

export interface WorkspaceRegistration {
  readonly id: string;
  readonly name: string;
  readonly folder: string;
  readonly source: Listed['source'];
  readonly isExample: boolean;
  readonly repo: string | null;
}

async function registrationOf({
  folder,
  listedIn,
  source,
  isExample,
  repo,
}: Listed): Promise<WorkspaceRegistration> {
  const file = pathIn(folder, 'workspace.yaml');
  const text = await readTextIfAny(file);
  if (text === null && repo !== undefined) {
    throw new Error(
      `${repo}: listed in ${listedIn} but not cloned to ${folder}; run npm run workspace -- pull`,
    );
  }
  if (text === null) {
    throw new Error(
      `${folder}: listed in ${listedIn} but holds no workspace.yaml; correct the link in ${listedIn}`,
    );
  }
  const result = identity.safeParse(parse(text));
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  const { id, name } = result.data;
  return { id, name, folder, source, isExample, repo: repo ?? null };
}

async function childrenOf(container: string): Promise<string[]> {
  const entries = await listFolder(container);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => pathIn(container, entry.name))
    .toSorted((a, b) => a.localeCompare(b));
}

async function registered(folders: readonly Listed[]): Promise<readonly WorkspaceRegistration[]> {
  const read = await Promise.all(folders.map(registrationOf));
  const by = new Map<string, string>();
  for (const { id, folder } of read) {
    const seen = by.get(id);
    if (seen !== undefined) throw new Error(`workspace ${id}: found in both ${seen} and ${folder}`);
    by.set(id, folder);
  }
  return read;
}

async function bundledIn(container: string): Promise<Listed[]> {
  const children = await childrenOf(container);
  return children.map((folder) => ({
    folder,
    listedIn: container,
    source: 'example',
    isExample: true,
  }));
}

/** What a Groundwork checkout at `home` reads, given GROUNDWORK_WORKSPACES and whether to read its local file. */
export async function registrationsAt(
  home: string,
  options: { readonly env?: string | undefined; readonly local: boolean },
): Promise<readonly WorkspaceRegistration[]> {
  const { env } = options;
  const examples = pathIn(home, BUNDLED);
  if (env !== undefined && env.trim() !== '') {
    const folders = env
      .split(path.delimiter)
      .filter((each) => each.trim() !== '')
      .map((each) => ({
        folder: resolvedFrom(home, each),
        listedIn: 'GROUNDWORK_WORKSPACES',
        source: 'environment' as const,
        isExample: path.dirname(resolvedFrom(home, each)) === examples,
      }));
    return registered(folders);
  }
  const { workspaces, bundled } = options.local
    ? await readLocal(home)
    : { workspaces: [], bundled: true };
  return registered([
    ...(bundled ? await bundledIn(examples) : []),
    ...workspaces.map((each) => ({
      folder: resolvedFrom(home, folderOf(each)),
      listedIn: LOCAL,
      source: 'local' as const,
      isExample: path.dirname(resolvedFrom(home, folderOf(each))) === examples,
      ...(typeof each === 'string' ? {} : { repo: each.repo }),
    })),
  ]);
}

export async function registeredAt(
  home: string,
  options: { readonly env?: string | undefined; readonly local: boolean },
): Promise<ReadonlyMap<string, string>> {
  const found = await registrationsAt(home, options);
  return new Map(found.map(({ id, folder }) => [id, folder]));
}

/** The local file of the checkout at `home`, or its defaults when there is none. */
export async function readLocal(
  home: string,
): Promise<{ readonly workspaces: readonly LocalEntry[]; readonly bundled: boolean }> {
  const text = await readTextIfAny(pathIn(home, LOCAL));
  const result = localFile.safeParse(text === null ? {} : (parse(text) ?? {}));
  if (!result.success) throw new Error(`${LOCAL}: ${result.error.message}`);
  return result.data;
}

/** Current registration, including provenance. No paths are sent to the browser outside development. */
export async function workspaceRegistrations(): Promise<readonly WorkspaceRegistration[]> {
  return registrationsAt(process.cwd(), {
    env: process.env.GROUNDWORK_WORKSPACES,
    local: process.env.VITEST === undefined,
  });
}

export function localWorkspaceDetails(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Commands never pick an arbitrary first workspace when more than one is available. */
export async function selectedWorkspace(id?: string): Promise<WorkspaceRegistration> {
  const found = await workspaceRegistrations();
  const selected =
    id === undefined && found.length === 1 ? found[0] : found.find((w) => w.id === id);
  if (selected !== undefined) return selected;
  const available = found.map((w) => `${w.name} (${w.id})`).join(', ');
  const reason =
    id === undefined ? 'Choose a workspace with --workspace <id>' : `No workspace ${id}`;
  throw new Error(
    `${reason}. Available: ${available === '' ? 'none' : available}. Run npm run workspace -- list to see their locations.`,
  );
}

/**
 * Every workspace's folder, by id. With `root`, a folder of workspace folders (tests and tools read one such
 * folder); without it, the workspaces this Groundwork is set up to read.
 */
export async function workspaceFolders(root?: string): Promise<ReadonlyMap<string, string>> {
  const found =
    root === undefined ? await workspaceRegistrations() : await registered(await bundledIn(root));
  return new Map(found.map(({ id, folder }) => [id, folder]));
}

/** The folder of one workspace, or null when no workspace has that id. */
export async function workspaceFolder(id: string, root?: string): Promise<string | null> {
  const found = await workspaceFolders(root);
  return found.get(id) ?? null;
}
