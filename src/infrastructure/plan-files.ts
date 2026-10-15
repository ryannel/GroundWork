import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// workspaces/<workspace>/plans/<slug>/assets/   screenshots and diagrams the plan cites
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

const root = (): string => path.join(process.cwd(), 'workspaces');
const folderOf = (workspace: string, slug: string, kind: PlanFolder): string =>
  path.join(root(), workspace, 'plans', slug, kind);

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
  return walk(folderOf(workspace, slug, kind), []);
}

/** One file, or null when it is not there. The segments cannot climb out of the folder. */
export async function readPlanFile(
  at: { workspace: string; slug: string; kind: PlanFolder },
  segments: readonly string[],
): Promise<Buffer | null> {
  const base = folderOf(at.workspace, at.slug, at.kind);
  const file = path.join(base, ...segments);
  if (!file.startsWith(base + path.sep)) return null;
  return readFile(file).catch(() => null);
}
