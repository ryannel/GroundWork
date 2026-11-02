import 'server-only';

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { SourceBaseline } from '@/domain/scan/scan.generated';

export function fixtureGit(repository: string, args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['-C', repository, ...args], { encoding: 'utf8' }).trim();
}

export function fixtureRepository(): string {
  const repository = mkdtempSync(path.join(tmpdir(), 'scan-freshness-'));
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  return repository;
}

export function fixtureCommit(
  repository: string,
  files: Readonly<Record<string, string>>,
): SourceBaseline {
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(path.join(repository, filename), content);
  }
  fixtureGit(repository, ['add', '-A']);
  fixtureGit(repository, ['commit', '-qm', 'Fixture change']);
  return {
    repo: 'fixture',
    ref: 'HEAD',
    commit: fixtureGit(repository, ['rev-parse', 'HEAD']),
    tree: fixtureGit(repository, ['rev-parse', 'HEAD^{tree}']),
    environmentDigest: 'env',
    ruleDigest: 'rule',
    toolchainDigest: 'tools',
    configDigest: 'config',
  };
}
