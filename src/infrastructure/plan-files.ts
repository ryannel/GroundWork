import 'server-only';
import path from 'node:path';

import { pathIn, readBytesIfAny, realPathOf } from '@/infrastructure/disk';

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

/** One file, or null when it is not there. The segments cannot climb out of the folder. */
export async function readPlanFile(
  at: { readonly workspace: string; readonly slug: string; readonly kind: PlanFolder },
  segments: readonly string[],
): Promise<Buffer | null> {
  if (at.slug === '' || at.slug === '.' || at.slug === '..' || /[/\\\0]/u.test(at.slug)) {
    return null;
  }
  return readUnder(at.workspace, ['plans', at.slug, at.kind], segments);
}

/** One of a workspace's assets, or null when it is not there. */
export async function readWorkspaceAsset(
  workspace: string,
  segments: readonly string[],
): Promise<Buffer | null> {
  return readUnder(workspace, ['assets'], segments);
}

async function readUnder(
  workspace: string,
  folders: readonly string[],
  segments: readonly string[],
): Promise<Buffer | null> {
  const folder = await workspaceFolder(workspace);
  if (folder === null) return null;
  const root = await realPathOf(folder);
  if (root === null) return null;
  const base = pathIn(root, ...folders);
  const file = pathIn(base, ...segments);
  if (!file.startsWith(base + path.sep)) return null;
  const resolved = await realPathOf(file);
  if (resolved?.startsWith(base + path.sep) !== true) return null;
  return readBytesIfAny(resolved);
}
