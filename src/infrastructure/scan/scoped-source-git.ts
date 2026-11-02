import 'server-only';

import { execFileSync } from 'node:child_process';

import type { ScanScope } from './scan-scope';

interface PinnedMetadata {
  readonly tree: string;
  readonly blobs: ReadonlyMap<string, string>;
  readonly sizes: ReadonlyMap<string, number>;
}

function pinnedGit(repository: string, args: readonly string[]): Buffer {
  return execFileSync('/usr/bin/git', ['--no-optional-locks', '-C', repository, ...args], {
    env: { NODE_ENV: 'production', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
  });
}

export function pinnedMetadata(repository: string, scope: ScanScope): PinnedMetadata {
  if (!/^[a-f\d]{40,64}$/u.test(scope.commit)) throw new Error('Expected a pinned commit.');
  const tree = pinnedGit(repository, ['rev-parse', '--verify', `${scope.commit}^{tree}`])
    .toString('utf8')
    .trim();
  const listing = pinnedGit(repository, [
    'ls-tree',
    '-l',
    '-z',
    '--full-tree',
    scope.commit,
    '--',
    ...scope.files.map((file) => file.path),
  ]);
  const blobs = new Map<string, string>();
  const sizes = new Map<string, number>();
  for (const record of listing
    .toString('utf8')
    .split('\0')
    .filter((item) => item !== '')) {
    const separator = record.indexOf('\t');
    const filename = record.slice(separator + 1);
    const [mode, kind, blob, size] = record.slice(0, separator).split(/\s+/u);
    if ((mode !== '100644' && mode !== '100755') || kind !== 'blob' || blob === undefined) {
      throw new Error(`Scope source is not a regular source file: ${filename}`);
    }
    const bytes = Number(size);
    if (size === undefined || !Number.isSafeInteger(bytes) || bytes < 0) {
      throw new Error(`Invalid pinned source size for ${filename}.`);
    }
    blobs.set(filename, blob);
    sizes.set(filename, bytes);
  }
  if (scope.files.some((file) => !blobs.has(file.path))) {
    throw new Error('A selected source is absent from the pinned commit.');
  }
  return { tree, blobs, sizes };
}

export function readPinnedSource(repository: string, blob: string): string {
  if (!/^[a-f\d]{40,64}$/u.test(blob)) throw new Error('Expected a Git blob id.');
  const bytes = pinnedGit(repository, ['cat-file', 'blob', blob]);
  const content = bytes.toString('utf8');
  if (content.includes('\0') || !Buffer.from(content).equals(bytes)) {
    throw new Error('Selected source is binary or not UTF-8.');
  }
  return content;
}
