import 'server-only';

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { workspaceFolders } from './workspace-folders';

// What a reader worked out, kept in memory until a file in the workspaces changes. Each read first stamps the
// workspaces' files (their names, sizes and times: a couple of milliseconds, with no file read), so an edit
// shows on the next request without a restart, and while nothing changes no page reads or checks a file twice.

/** Reads `key` once, then hands back the same answer until a file under the workspaces changes. */
export type Remember<T> = (
  root: string | undefined,
  key: string,
  read: () => Promise<T>,
) => Promise<T>;

interface Kept<T> {
  readonly stamp: string;
  readonly value: Promise<T>;
}

async function filesIn(folder: string, base: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const lists = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map(async (entry) => {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) return filesIn(file, base);
        const info = await stat(file).catch(() => null);
        if (info === null) return [];
        return [`${path.relative(base, file)}\t${String(info.mtimeMs)}\t${String(info.size)}`];
      }),
  );
  return lists.flat();
}

async function foldersOf(root: string | undefined): Promise<readonly string[]> {
  if (root !== undefined) return [root];
  const registered = await workspaceFolders();
  return [...registered.values()];
}

async function stampOf(root: string | undefined): Promise<string> {
  const folders = await foldersOf(root);
  const lists = await Promise.all(
    folders.map(async (folder) => [folder, ...(await filesIn(folder, folder))]),
  );
  return lists
    .flat()
    .toSorted((a, b) => a.localeCompare(b))
    .join('\n');
}

const stamping = new Map<string, Promise<string>>();

/** The workspaces' stamp; reads that arrive while one is being taken share it. */
async function currentStamp(root: string | undefined): Promise<string> {
  const at = root ?? '';
  const pending = stamping.get(at);
  if (pending !== undefined) return pending;
  const taking = stampOf(root).finally(() => {
    stamping.delete(at);
  });
  stamping.set(at, taking);
  return taking;
}

/** A cache for one reader. */
export function untilEdited<T>(): Remember<T> {
  const kept = new Map<string, Kept<T>>();
  return async (root, key, read) => {
    const stamp = await currentStamp(root);
    const at = `${root ?? ''}\n${key}`;
    const known = kept.get(at);
    if (known?.stamp === stamp) return known.value;
    const value = read();
    const entry = { stamp, value };
    kept.set(at, entry);
    value.catch(() => {
      if (kept.get(at) === entry) kept.delete(at);
    });
    return value;
  };
}
