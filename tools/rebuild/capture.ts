import { parseArgs } from 'node:util';

import { isRecord } from '@/application/plan/ids';
import { selectedWorkspace } from '@/infrastructure/workspace-folders';

import { captureFacts } from './facts';
import { captureRoute, selectedRoutes } from './routes';
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

export async function capture(options: {
  readonly workspace: string;
  readonly out: string;
  readonly asOf: string;
  readonly origin?: string | undefined;
  readonly routes?: readonly string[] | undefined;
}): Promise<CaptureManifest> {
  const selected = await selectedWorkspace(options.workspace);
  console.error(`Workspace: ${selected.name} (${selected.id}) at ${selected.folder}`);
  const routes = options.routes ?? (await selectedRoutes(selected.id));
  const files = ['facts.json.gz'];
  await writeSnapshot(options.out, files[0] ?? '', await captureFacts(selected.id, options.asOf));
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
