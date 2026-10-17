import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { workspaceFolder } from './workspace-folders';

// <workspace>/plans/<slug>/assets/   screenshots and diagrams the plan cites
//                                    mockups/   walking mockups, which link to ../assets/
export type PlanFolder = 'assets' | 'mockups';

const TYPES: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

export const contentTypeOf = (file: string): string =>
  TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

// A workspace no folder holds has no files.
async function inWorkspace(workspace: string, ...parts: readonly string[]): Promise<string | null> {
  const folder = await workspaceFolder(workspace);
  return folder === null ? null : path.join(folder, ...parts);
}

const folderOf = async (workspace: string, slug: string, kind: PlanFolder) =>
  inWorkspace(workspace, 'plans', slug, kind);

async function walk(folder: string, prefix: readonly string[]): Promise<string[][]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory()
        ? walk(path.join(folder, entry.name), [...prefix, entry.name])
        : [[...prefix, entry.name]],
    ),
  );
  return nested.flat();
}

/** Every file under a plan's assets or mockups, as path segments. */
export async function listPlanFiles(
  workspace: string,
  slug: string,
  kind: PlanFolder,
): Promise<string[][]> {
  const folder = await folderOf(workspace, slug, kind);
  return folder === null ? [] : walk(folder, []);
}

/** One file, or null when it is not there. The segments cannot climb out of the folder. */
export async function readPlanFile(
  at: { readonly workspace: string; readonly slug: string; readonly kind: PlanFolder },
  segments: readonly string[],
): Promise<Buffer | null> {
  const folder = await folderOf(at.workspace, at.slug, at.kind);
  return folder === null ? null : readUnder(folder, segments);
}

const assetsOf = async (workspace: string) => inWorkspace(workspace, 'assets');

/** Every file under a workspace's assets/, the images its system model cites, as path segments. */
export async function listWorkspaceAssets(workspace: string): Promise<string[][]> {
  const folder = await assetsOf(workspace);
  return folder === null ? [] : walk(folder, []);
}

/** One of a workspace's assets, or null when it is not there. */
export async function readWorkspaceAsset(
  workspace: string,
  segments: readonly string[],
): Promise<Buffer | null> {
  const folder = await assetsOf(workspace);
  return folder === null ? null : readUnder(folder, segments);
}

async function readUnder(base: string, segments: readonly string[]): Promise<Buffer | null> {
  const file = path.join(base, ...segments);
  if (!file.startsWith(base + path.sep)) return null;
  return readFile(file).catch(() => null);
}
