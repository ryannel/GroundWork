import 'server-only';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { z } from 'zod';

const sourceFile = z.object({
  path: z.string(),
  mode: z.string(),
  kind: z.string(),
  blob: z.string(),
});
const inventory = z.object({
  repo: z.string(),
  commit: z.string(),
  tree: z.string(),
  files: z.array(sourceFile),
});
const report = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/u),
  commit: z.string().regex(/^[a-f\d]{40,64}$/u),
  tree: z.string(),
  runStatus: z.literal('source_complete'),
  trials: z.array(z.object({ document: z.string() })),
});
export type DiscoverySourceFile = z.infer<typeof sourceFile> & { readonly bytes: number };
export interface DiscoverySource {
  readonly repo: string;
  readonly commit: string;
  readonly files: readonly DiscoverySourceFile[];
  readonly directory: string;
  readonly clone: string;
  readonly snapshot: string | null;
  readonly snapshotSha256: string;
  readonly reportSha256: string;
  readonly inventorySha256: string;
}
export function discoveryDigest(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function discoveryGit(clone: string, args: readonly string[]): Buffer {
  return execFileSync('/usr/bin/git', ['--no-optional-locks', '-C', clone, ...args], {
    env: { GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
  });
}
export function discoveryLocal(directory: string, relative: string): string {
  const resolved = path.resolve(directory, relative);
  if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) {
    throw new Error('Discovery input path leaves source capture.');
  }
  return resolved;
}
async function streamedDigest(filename: string): Promise<string> {
  const digest = createHash('sha256');
  await pipeline(createReadStream(filename), digest);
  return digest.digest('hex');
}
async function jsonBytes(
  filename: string,
): Promise<{ readonly bytes: Buffer; readonly value: unknown }> {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.size > 64 * 1024 * 1024) {
    throw new Error('Oversized discovery metadata.');
  }
  const bytes = await readFile(filename);
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}
function treeFiles(clone: string, commit: string): readonly DiscoverySourceFile[] {
  return discoveryGit(clone, ['ls-tree', '-rlz', '--full-tree', commit])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf('\t');
      const [mode, kind, blob, size] = record.slice(0, separator).split(/\s+/u);
      if (mode === undefined || kind === undefined || blob === undefined) {
        throw new Error('Invalid Git tree.');
      }
      return { path: record.slice(separator + 1), mode, kind, blob, bytes: Number(size) };
    });
}
function verifyTree(
  files: readonly DiscoverySourceFile[],
  stored: z.infer<typeof inventory>,
): void {
  const actual = new Map(files.map((item) => [item.path, item]));
  if (actual.size !== stored.files.length) {
    throw new Error('Discovery tracked-tree denominator changed.');
  }
  for (const item of stored.files) {
    const pinned = actual.get(item.path);
    if (pinned?.mode !== item.mode || pinned.kind !== item.kind || pinned.blob !== item.blob) {
      throw new Error('Discovery inventory differs from pinned Git tree.');
    }
  }
}
async function verifyState(
  directory: string,
  reportSha256: string,
  inventoryValue: unknown,
): Promise<ReadonlyMap<string, string>> {
  const stateBytes = await jsonBytes(path.join(directory, 'run-state.json'));
  const state = z
    .object({
      status: z.literal('source_complete'),
      reportDigest: z.string(),
      planDigest: z.string(),
      completed: z.array(
        z.object({ artifacts: z.array(z.object({ path: z.string(), digest: z.string() })) }),
      ),
    })
    .parse(stateBytes.value);
  const planBytes = await jsonBytes(path.join(directory, 'run-plan.json'));
  const planValue = planBytes.value;
  const plan = z
    .object({ inventoryDigest: z.string(), scopes: z.array(z.unknown()) })
    .parse(planValue);
  if (state.completed.length !== plan.scopes.length) {
    throw new Error('Incomplete source checkpoint roster.');
  }
  if (
    state.reportDigest !== reportSha256 ||
    state.planDigest !== discoveryDigest(JSON.stringify(planValue))
  ) {
    throw new Error('Discovery source publication hash/state changed.');
  }
  if (plan.inventoryDigest !== discoveryDigest(JSON.stringify(inventoryValue))) {
    throw new Error('Discovery source inventory hash changed.');
  }
  return new Map(
    state.completed.flatMap((task) =>
      task.artifacts.map((artifact) => [artifact.path, artifact.digest]),
    ),
  );
}
/** Metadata-only verification precedes any target source-byte reads. */
export async function loadDiscoverySource(
  directory: string,
  cloneRoot: string,
): Promise<DiscoverySource> {
  const aggregate = await jsonBytes(path.join(directory, 'repository.json'));
  const selected = report.parse(aggregate.value);
  const stored = await jsonBytes(path.join(directory, 'inventory.json'));
  const tracked = inventory.parse(stored.value);
  const reportSha256 = discoveryDigest(aggregate.bytes);
  const artifactDigests = await verifyState(directory, reportSha256, stored.value);
  if (
    tracked.repo !== selected.repo ||
    tracked.commit !== selected.commit ||
    tracked.tree !== selected.tree
  ) {
    throw new Error('Discovery source pins disagree.');
  }
  const clone = path.resolve(cloneRoot, selected.repo);
  const tree = discoveryGit(clone, ['rev-parse', '--verify', `${selected.commit}^{tree}`])
    .toString('utf8')
    .trim();
  if (tree !== selected.tree) throw new Error('Discovery source tree changed.');
  const files = treeFiles(clone, selected.commit);
  verifyTree(files, tracked);
  const document = selected.trials[0]?.document;
  const snapshot = document === undefined ? null : discoveryLocal(directory, document);
  const snapshotSha256 = snapshot === null ? '' : await streamedDigest(snapshot);
  if (document !== undefined && artifactDigests.get(document) !== snapshotSha256) {
    throw new Error('Target source snapshot differs from checkpoint hash.');
  }
  return {
    repo: selected.repo,
    commit: selected.commit,
    files,
    directory,
    clone,
    snapshot,
    snapshotSha256,
    reportSha256,
    inventorySha256: discoveryDigest(stored.bytes),
  };
}
export function discoveryBlobDigest(bytes: Buffer, blob: string): string {
  return createHash(blob.length === 64 ? 'sha256' : 'sha1')
    .update(`blob ${String(bytes.length)}\0`)
    .update(bytes)
    .digest('hex');
}
/** Retained canonical bytes are preferred; both paths must match the pinned Git object. */
export async function readDiscoveryBytes(
  source: DiscoverySource,
  file: DiscoverySourceFile,
): Promise<{
  readonly bytes: Buffer;
  readonly origin: 'retained' | 'git';
}> {
  const retained = path.join(source.directory, 'ancillary', `${file.blob}.txt`);
  const metadata = await lstat(retained).catch(() => null);
  const cached =
    metadata?.isFile() === true && metadata.size === file.bytes ? await readFile(retained) : null;
  if (cached !== null && discoveryBlobDigest(cached, file.blob) === file.blob) {
    return { bytes: cached, origin: 'retained' };
  }
  const bytes = discoveryGit(source.clone, ['cat-file', 'blob', file.blob]);
  if (bytes.length !== file.bytes || discoveryBlobDigest(bytes, file.blob) !== file.blob) {
    throw new Error('Discovery source blob hash/size changed.');
  }
  return { bytes, origin: 'git' };
}
