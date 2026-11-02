import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildDiscoveryPackets } from '@/infrastructure/scan/discovery-inventory-packets';
import {
  discoveryDigest,
  loadDiscoverySource,
} from '@/infrastructure/scan/discovery-inventory-source';
import { discoveryAnalysisVersion } from '@/infrastructure/scan/discovery-inventory-version';

export { readDiscoveryInventory } from '@/infrastructure/scan/discovery-inventory-verify';

export async function discoveryInventory(input: {
  readonly capture: string;
  readonly cloneRoot: string;
  readonly output: string;
  readonly contextPaths?: readonly string[];
}): Promise<void> {
  const source = await loadDiscoverySource(input.capture, input.cloneRoot);
  const version = await discoveryAnalysisVersion();
  await mkdir(input.output);
  const result = await buildDiscoveryPackets({
    source,
    output: path.resolve(input.output),
    analysisVersion: version,
    ...(input.contextPaths === undefined ? {} : { extraPaths: input.contextPaths }),
  });
  const artifacts = await Promise.all(
    Object.entries({
      'inventory.json': result.inventory,
      'packets.json': result.packets,
      'inputs.json': result.inputs,
    }).map(async ([filename, value]) => {
      const bytes = `${JSON.stringify(value, null, 2)}\n`;
      await writeFile(path.join(input.output, filename), bytes, { flag: 'wx' });
      return { path: filename, sha256: discoveryDigest(bytes) };
    }),
  );
  await writeFile(
    path.join(input.output, 'publication.json'),
    `${JSON.stringify(
      {
        format: 'scan-discovery-inventory-publication/v1',
        source_capture: path.resolve(input.capture),
        clone_root: path.resolve(input.cloneRoot),
        context_paths: input.contextPaths ?? [],
        repo: source.repo,
        commit: source.commit,
        analysis_version: version,
        source_report_sha256: source.reportSha256,
        source_inventory_sha256: source.inventorySha256,
        snapshot_sha256: result.inventory.snapshot_sha256,
        inventory_sha256: result.inventory.sha256,
        artifacts,
        contexts: [
          ...new Set(
            result.inputs.inputs
              .filter((item) => item.kind === 'context_snapshot')
              .map((item) => item.path),
          ),
        ].map((filename) => ({ path: filename, sha256: path.basename(filename, '.txt') })),
        modelCalls: 0,
        state: 'inventory_only_discovery_acceptance_separate',
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
}
async function contextPathList(filename: string | undefined): Promise<readonly string[]> {
  if (filename === undefined) return [];
  const metadata = await lstat(filename);
  if (!metadata.isFile() || metadata.size > 1_048_576) {
    throw new Error('Context path manifest exceeds 1 MiB or is not a regular file.');
  }
  const paths: unknown = JSON.parse(await readFile(filename, 'utf8'));
  if (!Array.isArray(paths) || !paths.every((item): item is string => typeof item === 'string')) {
    throw new Error('Context paths must be a JSON string array.');
  }
  if (paths.length > 4096) throw new Error('Context path count exceeds 4096.');
  return paths;
}
async function main(args: readonly string[]): Promise<void> {
  const [capture, cloneRoot, output, flag, contextFile] = args;
  if (
    ![3, 5].includes(args.length) ||
    capture === undefined ||
    cloneRoot === undefined ||
    output === undefined
  ) {
    throw new Error(
      'Usage: scan-discovery-inventory.ts <source-capture-directory> <cloneRoot> <NEW-output> [--context-paths paths.json]',
    );
  }
  if (args.length === 5 && (flag !== '--context-paths' || contextFile === undefined)) {
    throw new Error('Expected --context-paths <JSON array file>.');
  }
  const contextPaths = await contextPathList(contextFile);
  await discoveryInventory({
    contextPaths,
    capture: path.resolve(capture),
    cloneRoot: path.resolve(cloneRoot),
    output: path.resolve(output),
  });
  console.log(JSON.stringify({ output, state: 'inventory_only', modelCalls: 0 }));
}
if (process.argv[1] === import.meta.filename) await main(process.argv.slice(2));
