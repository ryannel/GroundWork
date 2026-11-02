import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { Source } from '@/domain/scan/scan.generated';

import { repositoryGit } from './scan-repository-inventory';
import { auditScanSources } from './scan-source-audit';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./scan-repository-inventory'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, repositoryGit: vi.fn<typeof actual.repositoryGit>(actual.repositoryGit) };
});
const directories: string[] = [];

function git(repository: string, args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['-C', repository, ...args], {
    encoding: 'utf8',
    env: { NODE_ENV: 'test', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function fixture() {
  const cloneRoot = mkdtempSync(path.join(tmpdir(), 'scan-source-audit-'));
  directories.push(cloneRoot);
  const repository = path.join(cloneRoot, 'fixture', 'repo');
  mkdirSync(repository, { recursive: true });
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.name', 'Fixture']);
  git(repository, ['config', 'user.email', 'fixture@example.test']);
  writeFileSync(path.join(repository, 'main.ts'), 'first\nsecond\nthird');
  writeFileSync(path.join(repository, 'other.ts'), 'different');
  writeFileSync(path.join(repository, 'invalid.ts'), Buffer.from([0xc3, 0x28]));
  symlinkSync('main.ts', path.join(repository, 'linked.ts'));
  git(repository, ['add', '.']);
  git(repository, ['commit', '-qm', 'Synthetic audit fixture']);
  const source: Source = {
    kind: 'source',
    id: 'source:main',
    repo: 'fixture/repo',
    path: 'main.ts',
    commit: git(repository, ['rev-parse', 'HEAD']),
    blob: git(repository, ['rev-parse', 'HEAD:main.ts']),
    lines: [1, 3],
    host: 'host:server',
    authority: 'declared',
  };
  return { cloneRoot, repository, source };
}
function document(...sources: readonly Source[]) {
  return { ...scanFixture(), sources: [...sources] };
}
afterEach(() => {
  vi.mocked(repositoryGit).mockReset();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('independent pinned Git source audit', () => {
  it('verifies every anchor against pinned bytes once per file while ignoring changed worktree and HEAD', () => {
    const { cloneRoot, repository, source } = fixture();
    writeFileSync(path.join(repository, 'main.ts'), 'changed');
    git(repository, ['add', 'main.ts']);
    git(repository, ['commit', '-qm', 'Move local HEAD']);
    writeFileSync(path.join(repository, 'main.ts'), 'dirty again');
    writeFileSync(path.join(repository, 'untracked.ts'), 'untracked');
    const read = vi.mocked(repositoryGit);
    const result = auditScanSources(
      document(source, { ...source, id: 'source:second', lines: [2, 2] }),
      cloneRoot,
    );
    expect(result).toEqual({
      supported: true,
      anchors: 2,
      files: [
        {
          repo: source.repo,
          commit: source.commit,
          path: source.path,
          blob: source.blob,
          lines: 3,
        },
      ],
      authority: 'pinned_local_git',
      remoteCurrent: 'unobserved',
      deploymentCurrent: 'unobserved',
    });
    expect(read.mock.calls.filter(([, args]) => args[0] === 'cat-file')).toEqual([
      [repository, ['cat-file', 'blob', source.blob]],
    ]);
  });

  it.each(['blob', 'path', 'commit'] as const)('rejects the wrong pinned %s', (field) => {
    const { cloneRoot, repository, source } = fixture();
    writeFileSync(path.join(repository, 'main.ts'), 'different revision');
    git(repository, ['add', 'main.ts']);
    git(repository, ['commit', '-qm', 'Different source revision']);
    const wrong = {
      blob: git(repository, ['rev-parse', 'HEAD:other.ts']),
      path: 'missing.ts',
      commit: git(repository, ['rev-parse', 'HEAD']),
    };
    expect(() =>
      auditScanSources(document({ ...source, [field]: wrong[field] }), cloneRoot),
    ).toThrow('pinned Git tree');
  });

  it('keeps independently pinned revisions of the same file separate', () => {
    const { cloneRoot, repository, source } = fixture();
    writeFileSync(path.join(repository, 'main.ts'), 'new revision');
    git(repository, ['add', 'main.ts']);
    git(repository, ['commit', '-qm', 'Second source revision']);
    const next: Source = {
      ...source,
      id: 'source:new',
      lines: [1, 1],
      commit: git(repository, ['rev-parse', 'HEAD']),
      blob: git(repository, ['rev-parse', 'HEAD:main.ts']),
    };
    const result = auditScanSources(document(source, next), cloneRoot);
    expect(result.files.map(({ commit, blob, lines }) => ({ commit, blob, lines }))).toEqual([
      { commit: source.commit, blob: source.blob, lines: 3 },
      { commit: next.commit, blob: next.blob, lines: 1 },
    ]);
  });

  it('recomputes the Git object hash rather than trusting returned blob bytes', () => {
    const { cloneRoot, source } = fixture();
    vi.mocked(repositoryGit).mockReturnValueOnce(Buffer.from('tampered'));
    expect(() => auditScanSources(document(source), cloneRoot)).toThrow('pinned UTF-8 Git blob');
  });

  it.each([
    [3, 2],
    [1, 4],
    [0, 1],
    [-1, 1],
  ] as const)('rejects invalid line bounds %j', (start, end) => {
    const { cloneRoot, source } = fixture();
    expect(() => auditScanSources(document({ ...source, lines: [start, end] }), cloneRoot)).toThrow(
      'pinned file lines',
    );
  });

  it('checks every anchor even when the file bytes were already verified', () => {
    const { cloneRoot, source } = fixture();
    expect(() =>
      auditScanSources(document(source, { ...source, id: 'source:bad', lines: [1, 4] }), cloneRoot),
    ).toThrow('pinned file lines');
  });

  it.each(['invalid.ts', 'linked.ts'])(
    'rejects non-UTF-8 or non-regular pinned evidence: %s',
    (filename) => {
      const { cloneRoot, repository, source } = fixture();
      const anchor: Source = {
        ...source,
        path: filename,
        blob: git(repository, ['rev-parse', `HEAD:${filename}`]),
        lines: [1, 1],
      };
      expect(() => auditScanSources(document(anchor), cloneRoot)).toThrow(
        /pinned (?:UTF-8 Git blob|Git tree)/u,
      );
    },
  );

  it.each(['../repo', 'fixture/..', '/fixture/repo', 'fixture/repo/extra'])(
    'rejects unsafe repository identity %s before Git reads',
    (repo) => {
      const { cloneRoot, source } = fixture();
      const read = vi.mocked(repositoryGit);
      expect(() => auditScanSources(document({ ...source, repo }), cloneRoot)).toThrow(
        /repository identity|within the clone root/u,
      );
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('does not claim evidence support for an empty source selection', () => {
    expect(auditScanSources(document(), '/unused')).toEqual({
      supported: false,
      anchors: 0,
      files: [],
      authority: 'pinned_local_git',
      remoteCurrent: 'unobserved',
      deploymentCurrent: 'unobserved',
    });
  });
});
