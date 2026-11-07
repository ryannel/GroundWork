import { copyFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { isRecord } from '@/application/plan/ids';
import { selectedWorkspace } from '@/infrastructure/workspace-folders';

import { captureFacts } from './facts';
import { factChecksums } from './model-facts';
import { captureRoute } from './route-response';
import { selectedRoutes } from './routes';
import { withSite } from './site';
import { digest, readSnapshot, writeSnapshot } from './snapshots';

export interface CaptureManifest {
  readonly format: 1;
  readonly workspace: string;
  readonly asOf: string;
  readonly routes: readonly string[];
  readonly files: readonly string[];
}

const strings = (list: unknown): list is readonly string[] =>
  Array.isArray(list) && list.every((item) => typeof item === 'string');

export function manifestOf(value: unknown): CaptureManifest {
  if (!isRecord(value) || value.format !== 1) throw new Error('Unsupported baseline format.');
  const { workspace, asOf, routes, files } = value;
  if (typeof workspace !== 'string' || typeof asOf !== 'string') {
    throw new TypeError('Baseline identity is missing.');
  }
  if (!strings(routes) || !strings(files)) {
    throw new Error('Baseline file and route lists are missing.');
  }
  if (files.some((file) => !/^[\w-]+\.json\.gz$/u.test(file))) {
    throw new Error('Unsafe baseline file name.');
  }
  return { format: 1, workspace, asOf, routes, files };
}

interface FactCapture {
  readonly format: 1;
  readonly workspace: string;
  readonly asOf: string;
  readonly files: readonly string[];
}
const FACT_CAPTURE = 'facts-capture.json';

export async function captureFactFiles(options: {
  readonly workspace: string;
  readonly out: string;
  readonly asOf: string;
}): Promise<FactCapture> {
  const files = await captureFacts(options.workspace, options.out);
  const result: FactCapture = {
    format: 1,
    workspace: options.workspace,
    asOf: options.asOf,
    files,
  };
  await writeSnapshot(options.out, FACT_CAPTURE, result);
  return result;
}

function factCaptureOf(value: unknown, workspace: string, asOf: string): FactCapture {
  if (
    !isRecord(value) ||
    value.format !== 1 ||
    value.workspace !== workspace ||
    value.asOf !== asOf
  ) {
    throw new Error('Fact capture does not match the requested workspace and date.');
  }
  const { files } = value;
  if (!strings(files) || !files.includes('facts.json.gz') || new Set(files).size !== files.length) {
    throw new Error('Incomplete fact capture.');
  }
  return { format: 1, workspace, asOf, files };
}

async function reuseFacts(
  source: string,
  out: string,
  workspace: string,
  asOf: string,
): Promise<readonly string[]> {
  const receipt = factCaptureOf(await readSnapshot(source, FACT_CAPTURE), workspace, asOf);
  const checksums = factChecksums(await readSnapshot(source, 'facts.json.gz'));
  const sharded = receipt.files.filter((file) => file !== 'facts.json.gz');
  if (sharded.length !== checksums.size || sharded.some((file) => !checksums.has(file))) {
    throw new Error('Fact capture does not list every native shard.');
  }
  await mkdir(out, { recursive: true });
  const sameFolder = (await realpath(source)) === (await realpath(out));
  for (const file of receipt.files) {
    const checksum = checksums.get(file);
    if (checksum !== undefined) await readSnapshot(source, file, checksum);
    if (!sameFolder) await copyFile(path.join(source, file), path.join(out, file));
  }
  return receipt.files;
}

export async function capture(options: {
  readonly workspace: string;
  readonly out: string;
  readonly asOf: string;
  readonly origin?: string | undefined;
  readonly routes?: readonly string[] | undefined;
  readonly factFolder?: string | undefined;
}): Promise<CaptureManifest> {
  const selected = await selectedWorkspace(options.workspace);
  console.error(`Workspace: ${selected.name} (${selected.id}) at ${selected.folder}`);
  const routes = options.routes ?? (await selectedRoutes(selected.id));
  const captured =
    options.factFolder === undefined
      ? await captureFacts(selected.id, options.out)
      : await reuseFacts(options.factFolder, options.out, selected.id, options.asOf);
  const files = [...captured];
  await withSite(options.origin, async (origin) => {
    for (const route of routes) {
      const file = `route-${digest(route).slice(0, 20)}.json.gz`;
      console.error(`Capturing ${route}`);
      await writeSnapshot(options.out, file, await captureRoute(origin, route));
      files.push(file);
    }
  });
  const manifest: CaptureManifest = {
    format: 1,
    workspace: selected.id,
    asOf: options.asOf,
    routes,
    files,
  };
  // Written last: a failed capture never advertises itself as complete.
  await writeSnapshot(options.out, 'manifest.json', manifest);
  return manifest;
}

export function argumentsOf(): { readonly values: Readonly<Record<string, string | undefined>> } {
  return parseArgs({
    options: {
      workspace: { type: 'string' },
      out: { type: 'string' },
      before: { type: 'string' },
      candidate: { type: 'string' },
      facts: { type: 'string' },
      origin: { type: 'string' },
      'as-of': { type: 'string' },
      allowed: { type: 'string' },
      routes: { type: 'string' },
    },
  });
}

export async function routeList(
  folder: string | undefined,
): Promise<readonly string[] | undefined> {
  if (folder === undefined) return undefined;
  return manifestOf(await readSnapshot(folder, 'manifest.json')).routes;
}
