import 'server-only';

import { constants, type Dirent } from 'node:fs';
import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import { EXPLORER_ASSET } from '@/infrastructure/explorer-assets';

// Copies a finished publication into <workspace>/explorer/corpus/<generation>/, where the site reads it on request.

export async function copyExplorerAssets(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  const directory = await lstat(source);
  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new Error('Explorer publication must be a regular directory');
  }
  const entries = await readdir(source, { withFileTypes: true });
  const names = entries.filter((entry) => EXPLORER_ASSET.test(entry.name));
  await copyAssetBatch(names, { source, target }, 0);
}

async function copyAssetBatch(
  files: readonly Dirent[],
  paths: { readonly source: string; readonly target: string },
  offset: number,
): Promise<void> {
  if (offset >= files.length) return;
  await Promise.all(
    files.slice(offset, offset + 64).map(async (entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error('Explorer publication cannot contain non-regular files');
      }
      await copyFile(
        path.join(paths.source, entry.name),
        path.join(paths.target, entry.name),
        constants.COPYFILE_FICLONE,
      );
    }),
  );
  await copyAssetBatch(files, paths, offset + 64);
}
