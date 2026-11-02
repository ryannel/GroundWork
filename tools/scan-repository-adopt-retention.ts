import { createHash, timingSafeEqual } from 'node:crypto';
import { link, lstat, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';

import { retainedAncillaryPaths, type RetainedAncillary } from './scan-repository-adopt-checker';
import { repositoryGit } from './scan-repository-inventory';

interface RetentionInput {
  readonly source: string;
  readonly output: string;
  readonly cloneRoot: string;
  readonly plan: { readonly repo: string; readonly commit: string; readonly tree: string };
}
function pinnedBlobs(input: RetentionInput): ReadonlyMap<string, string> {
  const repository = path.join(input.cloneRoot, input.plan.repo);
  const tree = repositoryGit(repository, ['rev-parse', '--verify', `${input.plan.commit}^{tree}`])
    .toString('utf8')
    .trim();
  if (tree !== input.plan.tree) {
    throw new Error('Adoption source tree differs from the pinned Git commit.');
  }
  const listing = repositoryGit(repository, [
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    input.plan.commit,
  ]).toString('utf8');
  return new Map(
    listing
      .split('\0')
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        const split = entry.indexOf('\t');
        const [mode, kind, blob] = entry.slice(0, split).split(' ');
        const regular = kind === 'blob' && ['100644', '100755'].includes(mode ?? '');
        return [entry.slice(split + 1), regular ? (blob ?? '') : ''];
      }),
  );
}
async function verifyBody(directory: string, entry: RetainedAncillary): Promise<void> {
  const filename = path.join(directory, entry.evidence);
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.size !== entry.bytes || stat.size > 64 * 1024 * 1024) {
    throw new Error('Retained ancillary is not a bounded body with its declared size.');
  }
  const body = await readFile(filename);
  const hash = createHash(entry.blob.length === 40 ? 'sha1' : 'sha256')
    .update(`blob ${String(body.length)}\0`)
    .update(body)
    .digest('hex');
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(entry.blob, 'hex'))) {
    throw new Error('Retained ancillary body differs from its pinned Git blob.');
  }
}
export async function copyRetainedAncillary(input: RetentionInput): Promise<void> {
  const listing = await repositoryPassJson(path.join(input.source, 'inventory.json'));
  const entries = retainedAncillaryPaths(listing);
  const pinned = pinnedBlobs(input);
  const sourceDirectory = await lstat(path.join(input.source, 'ancillary'));
  if (!sourceDirectory.isDirectory()) {
    throw new Error('Ancillary directory changed.');
  }
  await mkdir(path.join(input.output, 'ancillary'));
  const copied = new Set<string>();
  for (const entry of entries) {
    if (pinned.get(entry.sourcePath) !== entry.blob) {
      throw new Error('Retained ancillary identity is outside the pinned Git tree.');
    }
    await verifyBody(input.source, entry);
    if (!copied.has(entry.evidence)) {
      await link(path.join(input.source, entry.evidence), path.join(input.output, entry.evidence));
      copied.add(entry.evidence);
    }
    await verifyBody(input.output, entry);
  }
}
