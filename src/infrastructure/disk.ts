import 'server-only';

import { constants, type Dirent, type Stats } from 'node:fs';
import { lstat, open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';

// Every file the site reads, it reads through here, and every path to one is made here. Which folder is known
// only when a page is asked for (a workspace can be anywhere on disk), so each read and each join is marked
// turbopackIgnore: the build reads an unmarked `path.join` as a file to ship with the page, and traces every
// file in the checkout the path could match, scan reports included.

function whenMissing<T>(error: unknown, fallback: T): T {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return fallback;
  throw error;
}

/** A path inside a folder. */
export function pathIn(folder: string, ...parts: readonly string[]): string {
  return path.join(/* turbopackIgnore: true */ folder, ...parts);
}

/** Where a path given in settings points, read from the folder it is relative to. */
export function resolvedFrom(base: string, target: string): string {
  return path.resolve(/* turbopackIgnore: true */ base, target);
}

export async function readText(file: string): Promise<string> {
  return readFile(/* turbopackIgnore: true */ file, 'utf8');
}

/** The file's text, or null when it does not exist. */
export async function readTextIfAny(file: string): Promise<string | null> {
  return readText(file).catch((error: unknown) => whenMissing(error, null));
}

/** The file's bytes, or null when it does not exist. */
export async function readBytesIfAny(file: string): Promise<Buffer | null> {
  return readFile(/* turbopackIgnore: true */ file).catch((error: unknown) =>
    whenMissing(error, null),
  );
}

/** The path with links resolved, or null when it does not exist. */
export async function realPathOf(file: string): Promise<string | null> {
  return realpath(/* turbopackIgnore: true */ file).catch((error: unknown) =>
    whenMissing(error, null),
  );
}

/** What a folder holds (with `recursive`, everything under it), or nothing when it does not exist. */
export async function listFolder(
  folder: string,
  options: { readonly recursive?: boolean } = {},
): Promise<Dirent[]> {
  const recursive = options.recursive ?? false;
  return readdir(/* turbopackIgnore: true */ folder, { withFileTypes: true, recursive }).catch(
    (error: unknown) => whenMissing(error, []),
  );
}

/** What the path points to, or null when there is nothing there. */
export async function statOf(file: string): Promise<Stats | null> {
  return stat(/* turbopackIgnore: true */ file).catch((error: unknown) => whenMissing(error, null));
}

/** The path itself, without following a link; null only when nothing is there. */
export async function entryAt(file: string): Promise<Stats | null> {
  return lstat(/* turbopackIgnore: true */ file).catch((error: unknown) =>
    whenMissing(error, null),
  );
}

/** The bytes of a regular file no bigger than `maximum`, or null when nothing is there. */
export async function readBoundedBytes(file: string, maximum: number): Promise<Buffer | null> {
  if (!Number.isSafeInteger(maximum) || maximum < 0) {
    throw new Error('A regular-file byte bound must be a non-negative safe integer.');
  }
  const entry = await entryAt(file);
  if (entry === null) return null;
  const exceeded = () =>
    new Error(`${file}: exceeds its regular-file byte bound of ${String(maximum)}`);
  if (!entry.isFile() || entry.size > maximum) throw exceeded();
  // Check and read the same open file. Do not follow a replacement link or block on a replacement pipe.
  const handle = await open(
    /* turbopackIgnore: true */ file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  ).catch((error: unknown) => whenMissing(error, null));
  if (handle === null) return null;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maximum) throw exceeded();
    // The inclusive end reads one extra byte, detecting growth without ever buffering an unbounded file.
    const bytes = await buffer(
      handle.createReadStream({ start: 0, end: maximum, autoClose: false }),
    );
    if (bytes.length > maximum) throw exceeded();
    return bytes;
  } finally {
    await handle.close();
  }
}
