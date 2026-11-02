import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import type { ScopedSourceOptions, ScopedSources } from '@/infrastructure/scan/scoped-source-store';

export interface IncrementalFixture {
  readonly repository: string;
  readonly options: ScopedSourceOptions;
  readonly scope: ScanScope;
}

function git(repository: string, args: readonly string[]): string {
  return execFileSync(
    '/usr/bin/git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.attributesFile=/dev/null',
      '-c',
      'core.autocrlf=false',
      '-c',
      'commit.gpgsign=false',
      '-C',
      repository,
      ...args,
    ],
    {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        NODE_ENV: 'production',
        PATH: '/usr/bin:/bin',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_ATTR_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0',
        GIT_NO_LAZY_FETCH: '1',
        GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z',
        GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z',
      },
    },
  ).trim();
}

export function commitFixture(repository: string, message: string): string {
  git(repository, ['add', '--all']);
  git(repository, ['commit', '--quiet', '--no-verify', '-m', message]);
  return git(repository, ['rev-parse', 'HEAD']);
}

export function fixturePath(repository: string, relative: string): string {
  const filename = path.resolve(repository, relative);
  if (!filename.startsWith(`${repository}${path.sep}`) || relative.split('/').includes('.git')) {
    throw new Error('Fixture source path escapes the selected source directory.');
  }
  return filename;
}

export async function createBenchmarkFixture(input: {
  readonly scope: ScanScope;
  readonly options: ScopedSourceOptions;
  readonly selected: ScopedSources;
  readonly directory: string;
}): Promise<IncrementalFixture> {
  const cloneRoot = path.join(input.directory, 'clones');
  const repository = path.join(cloneRoot, input.scope.repo);
  await mkdir(repository, { recursive: true });
  for (const source of input.selected.sources) {
    const filename = fixturePath(repository, source.file.path);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, source.index.content);
  }
  git(repository, ['init', '--quiet', '-b', 'fixture']);
  git(repository, ['config', 'user.name', 'Groundwork synthetic fixture']);
  git(repository, ['config', 'user.email', 'synthetic-fixture@example.invalid']);
  const revision = commitFixture(repository, 'Synthetic fixture baseline');
  return {
    repository,
    scope: { ...input.scope, commit: revision, ref: 'refs/heads/fixture' },
    options: {
      ...input.options,
      authority: `synthetic_fixture:${input.options.authority}`,
      cloneRoot,
      cacheDirectory: path.join(input.directory, 'cache'),
    },
  };
}
