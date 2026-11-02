import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Evidence } from '@/domain/knowledge/knowledge.generated';

function clonePath(root: string, evidence: Evidence): string {
  const parts =
    evidence.host === 'github.com' ? [evidence.repo] : [evidence.host ?? '', evidence.repo];
  const directory = path.resolve(root, ...parts);
  const relative = path.relative(path.resolve(root), directory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${evidence.id}: clone escapes source root`);
  }
  return directory;
}

type SourceFacts = { readonly lines: number; readonly text: boolean } | { readonly error: string };

function newlineCount(chunk: Uint8Array): number {
  let lines = 0;
  for (const byte of chunk) {
    if (byte === 10) lines += 1;
  }
  return lines;
}

function lineFacts(file: string): SourceFacts {
  const descriptor = openSync(file, 'r');
  const buffer = Buffer.alloc(64 * 1024);
  let lines = 0;
  let text = true;
  let last: number | undefined;
  try {
    let size: number;
    while ((size = readSync(descriptor, buffer)) > 0) {
      const chunk = buffer.subarray(0, size);
      lines += newlineCount(chunk);
      text &&= !chunk.includes(0);
      last = chunk.at(-1);
    }
    if (last !== undefined && last !== 10) lines += 1;
    return { lines, text };
  } finally {
    closeSync(descriptor);
  }
}

function pinnedFacts(directory: string, evidence: Evidence): SourceFacts {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'groundwork-source-'));
  const file = path.join(folder, 'pinned');
  const descriptor = openSync(file, 'w');
  try {
    const source = spawnSync(
      'git',
      [
        '-C',
        directory,
        'show',
        '--no-ext-diff',
        '--no-textconv',
        `${evidence.commit}:${evidence.path}`,
      ],
      {
        stdio: ['ignore', descriptor, 'ignore'],
        timeout: 10_000,
        env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
      },
    );
    if (source.error !== undefined) return { error: 'pinned Git read failed' };
    if (source.status !== 0) return { error: 'pinned file unavailable in local clone' };
    return lineFacts(file);
  } finally {
    closeSync(descriptor);
    rmSync(folder, { recursive: true, force: true });
  }
}

function rangeProblems(evidence: Evidence, source: SourceFacts): string[] {
  if ('error' in source) return [`${evidence.id}: ${source.error}`];
  if (evidence.lines[0] > evidence.lines[1] || evidence.lines[1] > source.lines) {
    return [`${evidence.id}: source range outside pinned file`];
  }
  return source.text ? [] : [`${evidence.id}: source file is not text`];
}

/** Cache only counts/text checks for immutable pinned files during one validation run. */
export function sourceChecker(root: string): (evidence: Evidence) => string[] {
  const cache = new Map<string, SourceFacts>();
  return (evidence) => {
    const directory = clonePath(root, evidence);
    const key = JSON.stringify([directory, evidence.commit, evidence.path]);
    let facts = cache.get(key);
    if (facts === undefined) {
      facts = pinnedFacts(directory, evidence);
      cache.set(key, facts);
    }
    return rangeProblems(evidence, facts);
  };
}

/** Read the pinned Git object, never the potentially dirty working file. */
export function sourceProblems(root: string, evidence: Evidence): string[] {
  return sourceChecker(root)(evidence);
}
