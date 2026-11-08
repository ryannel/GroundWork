// Read current source attribution and gaps from the consolidated workspace model.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

async function nativeId(folder: string): Promise<string | null> {
  try {
    const header: unknown = parse(await readFile(path.join(folder, 'workspace.yaml'), 'utf8'));
    if (
      header === null ||
      typeof header !== 'object' ||
      !('format' in header) ||
      header.format !== 2
    ) {
      return null;
    }
    if (!('id' in header) || typeof header.id !== 'string') {
      throw new Error(`${folder}: workspace id is missing`);
    }
    return header.id;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function runNative(folder: string, id: string, args: readonly string[]): void {
  const tools = import.meta.dirname;
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      path.join(tools, 'register.ts'),
      '--conditions=react-server',
      path.join(tools, 'sources-model.ts'),
      folder,
      id,
      ...args,
    ],
    { cwd: path.dirname(tools), stdio: 'inherit' },
  );
  if (run.error !== undefined) throw run.error;
  process.exitCode = run.status ?? 1;
}

async function main(argv: readonly string[]): Promise<void> {
  const workspaceAt = argv.findIndex((arg) => !arg.startsWith('--'));
  const workspace = argv[workspaceAt];
  if (workspace === undefined) {
    console.error(
      'usage: node tools/sources.ts workspaces/<ws> [--missing] [--check] [--index [--repo org/name]]',
    );
    process.exit(2);
  }
  const folder = path.resolve(workspace);
  const id = await nativeId(folder);
  if (id === null) {
    throw new Error(
      `${folder}: expected a format-2 workspace. See artifacts/rebuild/pr10/scan-history.md for historical replay.`,
    );
  }
  runNative(
    folder,
    id,
    argv.filter((_, at) => at !== workspaceAt),
  );
}

await main(process.argv.slice(2));
