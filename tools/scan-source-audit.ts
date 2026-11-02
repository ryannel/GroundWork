import { createHash } from 'node:crypto';
import path from 'node:path';

import type { ScanDocument, Source } from '@/domain/scan/scan.generated';

import { repositoryGit, repositoryInventory } from './scan-repository-inventory';

interface VerifiedFile {
  readonly repo: string;
  readonly commit: string;
  readonly path: string;
  readonly blob: string;
  readonly lines: number;
}

function verifyBlob(repository: string, source: Source): VerifiedFile {
  const bytes = repositoryGit(repository, ['cat-file', 'blob', source.blob]);
  const hash = createHash(source.blob.length === 64 ? 'sha256' : 'sha1')
    .update(`blob ${String(bytes.length)}\0`)
    .update(bytes)
    .digest('hex');
  const text = bytes.toString('utf8');
  if (hash !== source.blob || !Buffer.from(text).equals(bytes)) {
    throw new Error(`Source ${source.id} does not match a pinned UTF-8 Git blob.`);
  }
  return {
    repo: source.repo,
    commit: source.commit,
    path: source.path,
    blob: source.blob,
    lines: text.split('\n').length,
  };
}

function repositoryPath(source: Source, cloneRoot: string): string {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(source.repo) || !/^[a-f\d]{40,64}$/u.test(source.commit)) {
    throw new Error('Source audit requires a repository identity and pinned commit.');
  }
  if (source.repo.split('/').some((segment) => ['.', '..'].includes(segment))) {
    throw new Error('Source audit repository must stay within the clone root.');
  }
  return path.join(cloneRoot, source.repo);
}

function repositorySources(sources: readonly Source[], cloneRoot: string): readonly VerifiedFile[] {
  const first = sources[0];
  if (!first) return [];
  const repository = repositoryPath(first, cloneRoot);
  const inventory = repositoryInventory(repository, first.commit);
  const tracked = new Map(inventory.files.map((file) => [file.path, file]));
  const files = new Map<string, VerifiedFile>();
  for (const source of sources) {
    const file = tracked.get(source.path);
    if (file?.blob !== source.blob || file.category === 'non-regular') {
      throw new Error(`Source ${source.id} does not match the pinned Git tree.`);
    }
    const verified = files.get(source.path) ?? verifyBlob(repository, source);
    files.set(source.path, verified);
    const validLines = source.lines.every((line) => Number.isSafeInteger(line) && line > 0);
    if (!validLines || source.lines[0] > source.lines[1] || source.lines[1] > verified.lines) {
      throw new Error(`Source ${source.id} exceeds its pinned file lines.`);
    }
  }
  return [...files.values()];
}

/** Verify only returned source records, independently of extractor assertions or worktree contents. */
export function auditScanSources(
  document: ScanDocument,
  cloneRoot: string,
): {
  readonly supported: boolean;
  readonly anchors: number;
  readonly files: readonly VerifiedFile[];
  readonly authority: 'pinned_local_git';
  readonly remoteCurrent: 'unobserved';
  readonly deploymentCurrent: 'unobserved';
} {
  const groups = new Map<string, Source[]>();
  for (const source of document.sources) {
    const key = `${source.repo}@${source.commit}`;
    const group = groups.get(key) ?? [];
    group.push(source);
    groups.set(key, group);
  }
  return {
    supported: document.sources.length > 0,
    anchors: document.sources.length,
    files: [...groups.values()].flatMap((sources) => repositorySources(sources, cloneRoot)),
    authority: 'pinned_local_git',
    remoteCurrent: 'unobserved',
    deploymentCurrent: 'unobserved',
  };
}
