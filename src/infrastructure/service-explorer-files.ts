import 'server-only';

import { createHash } from 'node:crypto';

import type { ExplorerManifest } from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';
import { pathIn, readBoundedBytes } from '@/infrastructure/disk';

import { explorerFilename, parseExplorerManifest } from './service-explorer-format';
import { workspaceFolder } from './workspace-folders';

export async function readExplorerManifest(
  workspace: string,
  root?: string,
): Promise<ExplorerManifest | null> {
  const directory = await workspaceFolder(workspace, root);
  if (directory === null) return null;
  const bytes = await readBoundedBytes(pathIn(directory, 'explorer', 'manifest.json'), 262_144);
  if (bytes === null) return null;
  const parsed = parseExplorerManifest(JSON.parse(bytes.toString('utf8')));
  if (parsed.workspace !== workspace) throw new Error('Explorer workspace mismatch');
  return parsed;
}

export async function readExplorerPage(
  workspace: string,
  filename: string,
  root?: string,
): Promise<Buffer | null> {
  const name = explorerFilename.parse(filename);
  const manifest = await readExplorerManifest(workspace, root);
  const directory = await workspaceFolder(workspace, root);
  const selected = manifest?.artifacts.find((item) => item.file === name);
  if (manifest === null || directory === null || selected === undefined) return null;
  const file = pathIn(directory, 'explorer', name);
  const bytes = await readBoundedBytes(file, selected.bytes);
  if (bytes === null) throw new Error('Missing selected explorer page');
  if (
    bytes.length !== selected.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== selected.sha256
  ) {
    throw new Error('Explorer page checksum changed');
  }
  const page = explorerPage(JSON.parse(bytes.toString('utf8')));
  if (page.snapshot !== manifest.snapshot) throw new Error('Explorer page snapshot mismatch');
  return bytes;
}
