import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureGit } from './freshness-git-fixture';
import type { ScanScope } from './scan-scope';
import { runScopedSources } from './scoped-source-store';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'scoped-source-'));
  folders.push(root);
  const repository = path.join(root, 'org', 'repo');
  mkdirSync(repository, { recursive: true });
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  const baseline = fixtureCommit(repository, {
    'source.ts': 'export function action(input: string) { return input; }',
    'unselected.ts': 'secret unselected source',
  });
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'fixture',
    repo: 'org/repo',
    commit: baseline.commit,
    ref: 'HEAD',
    files: [{ path: 'source.ts', language: 'typescript', environment: 'server' }],
    questions: [
      {
        id: 'action',
        profile: 'action',
        path: 'source.ts',
        symbol: 'action',
        checks: [{ kind: 'value', text: 'Return input' }],
      },
    ],
  };
  return {
    repository,
    scope,
    options: {
      authority: 'workspace:fixture',
      cloneRoot: root,
      cacheDirectory: path.join(root, 'cache'),
    },
  };
}
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function cacheFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? cacheFiles(filename) : [filename];
  });
}

describe('persistent pinned scoped source store', () => {
  it('reads only selected blobs once, ignores worktree dirt, and reuses indexes across runs', async () => {
    const input = fixture();
    const cold = await runScopedSources(input.scope, input.options);
    expect(cold.stats).toMatchObject({
      blobReads: 1,
      parsedFiles: 1,
      indexHits: 0,
      reusedFiles: 0,
    });
    expect(cold.sources).toHaveLength(1);
    expect(
      cold.sources[0]?.facts.sources.every((source) => source.blob === cold.sources[0]?.blob),
    ).toBe(true);
    expect(cold.sources[0]?.index.content).not.toContain('unselected');
    writeFileSync(path.join(input.repository, 'source.ts'), 'dirty worktree');
    const warm = await runScopedSources(input.scope, input.options);
    expect(warm.stats).toEqual({
      blobReads: 0,
      parsedFiles: 0,
      indexHits: 1,
      reusedFiles: 1,
      sourceBytes: 0,
    });
    expect(warm.sources).toEqual(cold.sources);
    expect(warm.baseline).toEqual(cold.baseline);
  });

  it('re-extracts changed rules from cached indexes and reparses changed parsers from cached source', async () => {
    const input = fixture();
    const cold = await runScopedSources(input.scope, input.options);
    const rules = await runScopedSources(input.scope, {
      ...input.options,
      ruleVersion: 'changed-rule',
    });
    expect(rules.stats).toMatchObject({
      blobReads: 0,
      parsedFiles: 0,
      indexHits: 1,
      sourceBytes: 0,
    });
    expect(rules.baseline.ruleDigest).not.toBe(cold.baseline.ruleDigest);
    const parser = await runScopedSources(input.scope, {
      ...input.options,
      parserVersion: 'changed-parser',
    });
    expect(parser.stats).toMatchObject({
      blobReads: 0,
      parsedFiles: 1,
      indexHits: 0,
      sourceBytes: 0,
    });
    expect(parser.baseline.toolchainDigest).not.toBe(cold.baseline.toolchainDigest);
  });

  it('reuses a same-blob rename while rebasing source anchors and commit evidence', async () => {
    const input = fixture();
    const cold = await runScopedSources(input.scope, input.options);
    fixtureGit(input.repository, ['mv', 'source.ts', 'renamed.ts']);
    fixtureGit(input.repository, ['commit', '-qm', 'Rename source']);
    const commit = fixtureGit(input.repository, ['rev-parse', 'HEAD']);
    const scope = {
      ...input.scope,
      commit,
      files: [{ path: 'renamed.ts', language: 'typescript', environment: 'server' } as const],
    };
    const renamed = await runScopedSources(scope, input.options);
    expect(renamed.stats).toMatchObject({ blobReads: 0, parsedFiles: 0, indexHits: 1 });
    expect(renamed.sources[0]?.index.path).toBe('renamed.ts');
    expect(renamed.sources[0]?.blob).toBe(cold.sources[0]?.blob);
    expect(
      renamed.sources[0]?.facts.sources.every(
        (source) => source.path === 'renamed.ts' && source.commit === commit,
      ),
    ).toBe(true);
  });

  it('reads only a changed selected blob and never shares source caches across scopes', async () => {
    const input = fixture();
    await runScopedSources(input.scope, input.options);
    const next = fixtureCommit(input.repository, {
      'source.ts': 'export function action() { return 2; }',
    });
    const changed = await runScopedSources({ ...input.scope, commit: next.commit }, input.options);
    expect(changed.stats).toMatchObject({ blobReads: 1, parsedFiles: 1, indexHits: 0 });
    const isolated = await runScopedSources({ ...input.scope, id: 'other-scope' }, input.options);
    expect(isolated.stats).toMatchObject({ blobReads: 1, parsedFiles: 1 });
    const otherAuthority = await runScopedSources(input.scope, {
      ...input.options,
      authority: 'workspace:other',
    });
    expect(otherAuthority.stats).toMatchObject({ blobReads: 1, parsedFiles: 1 });
  });

  it('repairs corrupt indexes from cached source without reading Git and preserves existing entries on missing source', async () => {
    const input = fixture();
    await runScopedSources(input.scope, input.options);
    const files = cacheFiles(input.options.cacheDirectory);
    const indexFile = files.find((filename) => filename.includes(`${path.sep}indexes${path.sep}`));
    expect(indexFile).toBeDefined();
    if (indexFile === undefined) throw new Error('Index fixture not written.');
    writeFileSync(
      indexFile,
      JSON.stringify({ format: 'scoped-source/v1', parser: 'corrupt', index: {} }),
    );
    const repaired = await runScopedSources(input.scope, input.options);
    expect(repaired.stats).toMatchObject({ blobReads: 0, parsedFiles: 1, indexHits: 0 });
    const before = cacheFiles(input.options.cacheDirectory).map((filename) =>
      readFileSync(filename, 'utf8'),
    );
    const missing = {
      ...input.scope,
      files: [{ path: 'missing.ts', language: 'typescript', environment: 'server' } as const],
    };
    await expect(runScopedSources(missing, input.options)).rejects.toThrow('absent');
    expect(
      cacheFiles(input.options.cacheDirectory).map((filename) => readFileSync(filename, 'utf8')),
    ).toEqual(before);
  });
});
