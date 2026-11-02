import 'server-only';

import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

import type { DiscoveryInventory } from '@/domain/scan/discovery-types';

import { discoveryInventoryDigest, parseDiscoveryInventory } from './discovery-format';
import { buildDiscoveryPackets, DISCOVERY_PACKET_LIMITS } from './discovery-inventory-packets';
import {
  discoveryBlobDigest,
  discoveryDigest,
  discoveryLocal,
  loadDiscoverySource,
  type DiscoverySource,
} from './discovery-inventory-source';
import { discoveryAnalysisVersion } from './discovery-inventory-version';

const publication = z
  .object({
    format: z.literal('scan-discovery-inventory-publication/v1'),
    source_capture: z.string(),
    clone_root: z.string(),
    context_paths: z
      .array(z.string())
      .max(4096)
      .refine((paths) => new Set(paths).size === paths.length),
    repo: z.string(),
    commit: z.string(),
    snapshot_sha256: z.string(),
    modelCalls: z.literal(0),
    state: z.literal('inventory_only_discovery_acceptance_separate'),
    source_report_sha256: z.string(),
    source_inventory_sha256: z.string(),
    analysis_version: z.string(),
    inventory_sha256: z.string(),
    artifacts: z
      .array(
        z
          .object({
            path: z.enum(['inventory.json', 'packets.json', 'inputs.json']),
            sha256: z.string(),
          })
          .strict(),
      )
      .length(3)
      .refine((items) => new Set(items.map((item) => item.path)).size === 3),
    contexts: z
      .array(z.object({ path: z.string(), sha256: z.string() }).strict())
      .max(4096)
      .refine((items) => new Set(items.map((item) => item.path)).size === items.length),
  })
  .strict();
async function boundedBytes(filename: string, maximum = 64 * 1024 * 1024): Promise<Buffer> {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.size > maximum) {
    throw new Error('Invalid/oversized discovery artifact.');
  }
  return readFile(filename);
}
async function verifyContexts(
  directory: string,
  inventory: DiscoveryInventory,
  source: DiscoverySource,
): Promise<void> {
  const files = new Map(source.files.map((file) => [file.path, file]));
  const checked = new Set<string>();
  await inventory.candidates
    .flatMap((candidate) => candidate.evidence)
    .reduce<Promise<void>>(async (previous, evidence) => {
      await previous;
      if (evidence.kind !== 'context_snapshot') {
        throw new Error('Scripted inventory requires canonical source contexts.');
      }
      const key = `${evidence.path}:${evidence.sha256}`;
      if (checked.has(key)) return;
      const file = files.get(evidence.path);
      const bytes = await boundedBytes(
        path.join(directory, 'contexts', `${evidence.sha256}.txt`),
        262_144,
      );
      const matches = [
        file !== undefined,
        evidence.commit === source.commit,
        discoveryDigest(bytes) === evidence.sha256,
        file?.blob === discoveryBlobDigest(bytes, file?.blob ?? ''),
      ].every(Boolean);
      if (!matches) {
        throw new Error('Discovery canonical context changed or is outside pinned tree.');
      }
      checked.add(key);
    }, Promise.resolve());
}
async function verifyExpectedInventory(input: {
  readonly directory: string;
  readonly source: DiscoverySource;
  readonly version: string;
  readonly contextPaths: readonly string[];
  readonly inventory: DiscoveryInventory;
}): Promise<void> {
  const expected = await buildDiscoveryPackets({
    source: input.source,
    output: path.resolve(input.directory),
    analysisVersion: input.version,
    extraPaths: input.contextPaths,
    persist: false,
  });
  if (!isDeepStrictEqual(input.inventory, expected.inventory)) {
    throw new Error(
      'Discovery candidate denominator/evidence differs from independently recomputed pinned source.',
    );
  }
  const inputsBytes = await boundedBytes(path.join(input.directory, 'inputs.json'));
  if (!isDeepStrictEqual(JSON.parse(inputsBytes.toString('utf8')), expected.inputs)) {
    throw new Error(
      'Discovery context input selection differs from independently recomputed pinned source.',
    );
  }
}
async function verifyPublishedArtifacts(
  directory: string,
  published: z.infer<typeof publication>,
): Promise<void> {
  const sizes = await Promise.all(
    published.contexts.map(async (context) => {
      const metadata = await lstat(discoveryLocal(directory, context.path));
      if (!metadata.isFile() || metadata.size > DISCOVERY_PACKET_LIMITS.fileBytes) {
        throw new Error('Invalid/oversized discovery context.');
      }
      return metadata.size;
    }),
  );
  if (sizes.reduce((total, size) => total + size, 0) > DISCOVERY_PACKET_LIMITS.totalBytes) {
    throw new Error('Discovery contexts exceed total byte bound.');
  }
  await [...published.artifacts, ...published.contexts].reduce<Promise<void>>(
    async (previous, artifact) => {
      await previous;
      const bytes = await boundedBytes(discoveryLocal(directory, artifact.path));
      if (discoveryDigest(bytes) !== artifact.sha256) {
        throw new Error('Discovery publication artifact changed.');
      }
    },
    Promise.resolve(),
  );
}
/** Recompute the candidate denominator from pinned source metadata, not a self-authored pass flag. */
export async function readDiscoveryInventory(directory: string): Promise<DiscoveryInventory> {
  const publicationBytes = await boundedBytes(path.join(directory, 'publication.json'));
  const published = publication.parse(JSON.parse(publicationBytes.toString('utf8')));
  const source = await loadDiscoverySource(published.source_capture, published.clone_root);
  const version = await discoveryAnalysisVersion();
  if (
    version !== published.analysis_version ||
    source.reportSha256 !== published.source_report_sha256 ||
    source.inventorySha256 !== published.source_inventory_sha256
  ) {
    throw new Error('Discovery publication inputs/rules changed.');
  }
  await verifyPublishedArtifacts(directory, published);
  const inventoryBytes = await boundedBytes(path.join(directory, 'inventory.json'));
  const inventory = parseDiscoveryInventory(JSON.parse(inventoryBytes.toString('utf8')));
  if (inventory.sha256 !== discoveryInventoryDigest(inventory)) {
    throw new Error('Discovery inventory canonical digest changed.');
  }
  await verifyExpectedInventory({
    directory,
    source,
    version,
    contextPaths: published.context_paths,
    inventory,
  });
  if (
    inventory.sha256 !== published.inventory_sha256 ||
    inventory.snapshot_sha256 !== published.snapshot_sha256
  ) {
    throw new Error('Discovery inventory target/digest changed.');
  }
  await verifyContexts(directory, inventory, source);
  return inventory;
}
