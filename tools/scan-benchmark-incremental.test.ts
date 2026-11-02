import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureGit } from '@/infrastructure/scan/freshness-git-fixture';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';

import { benchmarkIncremental } from './scan-benchmark-incremental';

vi.mock(import('server-only'), () => ({}));

const SELECTED = {
  'source.ts': 'export function action(input: string) { return input; }',
  'peer.ts': 'export function peer() { return "peer"; }',
};

function originalFixture(directory: string) {
  const repository = path.join(directory, 'clones', 'fixture', 'repo');
  mkdirSync(repository, { recursive: true });
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.invalid']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  const baseline = fixtureCommit(repository, {
    ...SELECTED,
    'unselected.ts': 'PRIVATE_UNSELECTED_LITERAL',
  });
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'fixture',
    repo: 'fixture/repo',
    commit: baseline.commit,
    ref: 'HEAD',
    files: Object.keys(SELECTED).map((filename) => ({
      path: filename,
      language: 'typescript',
      environment: 'server',
    })),
    questions: [
      {
        id: 'action',
        profile: 'endpoint',
        path: 'source.ts',
        symbol: 'action',
        checks: [{ kind: 'return', text: 'input' }],
      },
    ],
  };
  const options = {
    authority: 'workspace:fixture',
    cloneRoot: path.join(directory, 'clones'),
    cacheDirectory: path.join(directory, 'source-cache'),
  };
  return { repository, scope, options };
}

describe('isolated incremental benchmark', () => {
  it('reads and parses one changed blob, reuses a same-blob rename, and leaves original clones unchanged', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'scan-incremental-test-'));
    try {
      const fixture = originalFixture(directory);
      await runScopedSources(fixture.scope, fixture.options);
      const output = path.join(directory, 'output');
      const result = await benchmarkIncremental(fixture.scope, fixture.options, output);
      expect(result.authority).toBe('synthetic_fixture');
      expect(result.passed).toBe(true);
      expect(result.sourceCacheStats).toMatchObject({
        blobReads: 0,
        parsedFiles: 0,
        reusedFiles: 2,
      });
      expect(result.baseline.stats).toMatchObject({
        blobReads: 2,
        parsedFiles: 2,
        sourceBytes: Buffer.byteLength(Object.values(SELECTED).join('')),
      });
      expect(result.singleFileChange.stats).toMatchObject({
        blobReads: 1,
        parsedFiles: 1,
        reusedFiles: 1,
      });
      expect(result.singleFileChange.freshness).toMatchObject({
        state: 'changed',
        sourceCurrent: false,
        changedFiles: [{ path: 'source.ts', status: 'modified' }],
      });
      expect(result.singleFileChange.invalidation.changedFilesToParse).toEqual(['source.ts']);
      expect(result.singleFileChange.invalidation.invalidatedFacts).toContain(
        'fixture-file:source.ts',
      );
      expect(result.sameBlobRename.stats).toMatchObject({
        blobReads: 0,
        parsedFiles: 0,
        reusedFiles: 2,
      });
      expect(result.sameBlobRename.freshness.changedFiles).toMatchObject([
        { status: 'renamed', previousPath: 'source.ts', path: 'source.fixture-renamed.ts' },
      ]);
      expect(result.sameBlobRename.invalidation.changedFilesToParse).toEqual([]);
      expect(result.sameBlobRename.invalidation.refreshedAnchors).toEqual([
        'source.fixture-renamed.ts',
      ]);
      expect(result.sameBlobRename.anchorsRefreshed).toBe(true);
      expect(fixtureGit(fixture.repository, ['rev-parse', 'HEAD'])).toBe(fixture.scope.commit);
      expect(fixtureGit(fixture.repository, ['status', '--porcelain'])).toBe('');
      expect(readFileSync(path.join(fixture.repository, 'source.ts'), 'utf8')).toBe(
        SELECTED['source.ts'],
      );
      const receipt = readFileSync(path.join(output, 'incremental.json'), 'utf8');
      expect(receipt).not.toContain('PRIVATE_UNSELECTED_LITERAL');
      expect(receipt).not.toContain(SELECTED['source.ts']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
