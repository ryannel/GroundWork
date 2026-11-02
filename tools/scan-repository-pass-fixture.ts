import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fixtureCommit, fixtureGit } from '@/infrastructure/scan/freshness-git-fixture';
import {
  parseRepositoryPassPlan,
  parseRepositoryPassState,
  type RepositoryPassPlan,
  type RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';

const DEFAULT_FILES: Readonly<Record<string, string>> = {
  'a.ts': 'export function a() { return 1; }',
  'b.ts': 'export function b() { return 2; }',
};

export function passFixture(files: Readonly<Record<string, string>> = DEFAULT_FILES): {
  readonly root: string;
  readonly repository: string;
  readonly output: string;
  readonly args: readonly string[];
  readonly dispose: () => void;
} {
  const root = mkdtempSync(path.join(tmpdir(), 'repository-pass-'));
  const repository = path.join(root, 'org', 'repo');
  mkdirSync(repository, { recursive: true });
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  const pin = fixtureCommit(repository, files);
  const output = path.join(root, 'output');
  return {
    root,
    repository,
    output,
    args: [
      'org/repo',
      root,
      output,
      '--commit',
      pin.commit,
      '--cache',
      path.join(root, 'cache'),
      '--shard-size',
      '1',
    ],
    dispose: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
export function passJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8'));
}
export function passState(output: string): RepositoryPassState {
  return parseRepositoryPassState(passJson(path.join(output, 'run-state.json')));
}
export function passPlan(output: string): RepositoryPassPlan {
  return parseRepositoryPassPlan(passJson(path.join(output, 'run-plan.json')));
}
export function overwritePassJson(filename: string, value: unknown): void {
  writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}
export function passFileIdentity(filename: string): {
  readonly digest: string;
  readonly mtime: number;
} {
  return {
    digest: createHash('sha256').update(readFileSync(filename)).digest('hex'),
    mtime: statSync(filename).mtimeMs,
  };
}
