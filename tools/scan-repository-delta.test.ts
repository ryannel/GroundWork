import { mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureGit } from '@/infrastructure/scan/freshness-git-fixture';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';

import { repositoryDeltaScopes } from './scan-repository-delta';
import { repositoryInventory, type RepositoryFile } from './scan-repository-inventory';
import { repositoryScopes } from './scan-repository-scope';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture(files: Readonly<Record<string, string>>) {
  const root = mkdtempSync(path.join(tmpdir(), 'repository-delta-'));
  folders.push(root);
  const repository = path.join(root, 'org', 'repo');
  mkdirSync(repository, { recursive: true });
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  fixtureCommit(repository, files);
  const inventory = repositoryInventory(repository);
  const settings = { repo: 'org/repo', workspace: 'fixture', shardSize: 1 };
  const scopes = repositoryScopes({ ...inventory, ...settings });
  return {
    root,
    repository,
    inventory,
    scopes,
    settings,
    options: { authority: 'fixture', cloneRoot: root, cacheDirectory: path.join(root, 'cache') },
  };
}
function file(filename: string, blob: string): RepositoryFile {
  return {
    path: filename,
    blob,
    mode: '100644',
    kind: 'blob',
    category: 'source',
    language: 'typescript',
    selectedForParsing: true,
    reason: 'fixture',
  };
}
function synthetic(files: readonly RepositoryFile[]) {
  return {
    inventory: { commit: 'b'.repeat(40), tree: 'c'.repeat(40), files },
    repo: 'org/repo',
    workspace: 'fixture',
    shardSize: 1,
  };
}

describe('whole-repository delta scopes', () => {
  it('preserves modified, renamed and unchanged shard membership and cache reuse', async () => {
    const input = fixture({
      'b.ts': 'export const b=1;',
      'c.ts': 'export const c=2;',
      'd.ts': 'export const d=3;',
      'e.ts': 'export const e=4;',
      'settings.xml': '<before/>',
    });
    for (const scope of input.scopes) await runScopedSources(scope, input.options);
    renameSync(path.join(input.repository, 'c.ts'), path.join(input.repository, 'z.ts'));
    unlinkSync(path.join(input.repository, 'd.ts'));
    fixtureGit(input.repository, ['add', '--all']);
    fixtureCommit(input.repository, {
      'a.ts': 'export const a=5;',
      'b.ts': 'export const b=6;',
      'settings.xml': '<after/>',
    });
    const result = repositoryDeltaScopes({
      ...input.settings,
      inventory: repositoryInventory(input.repository),
      previousScopes: input.scopes,
      previousInventory: input.inventory.files,
    });
    expect(result.changes).toEqual({
      added: ['a.ts'],
      modified: ['b.ts', 'settings.xml'],
      deleted: ['d.ts'],
      renamed: [{ previousPath: 'c.ts', path: 'z.ts' }],
      unchanged: ['e.ts'],
    });
    expect(result.scopes.map((scope) => [scope.id, scope.files[0]?.path])).toEqual([
      ['repository-0001', 'b.ts'],
      ['repository-0002', 'z.ts'],
      ['repository-0004', 'e.ts'],
      ['repository-0005', 'a.ts'],
    ]);
    expect(result.retiredScopeIds).toEqual(['repository-0003']);
    const stats = [];
    for (const scope of result.scopes) {
      const scanned = await runScopedSources(scope, input.options);
      stats.push(scanned.stats);
    }
    expect(stats.map((entry) => [entry.blobReads, entry.parsedFiles, entry.indexHits])).toEqual([
      [1, 1, 0],
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 0],
    ]);
  });
  it('keeps per-file question IDs after deletion and regenerates investigation declarations', () => {
    const initial = synthetic([file('a.ts', 'a'), file('b.ts', 'b')]);
    const previous = repositoryScopes({
      ...initial.inventory,
      ...initial,
      files: initial.inventory.files,
      shardSize: 2,
    });
    const changed = previous.map((scope) => ({
      ...scope,
      questions: scope.questions.map((question) => ({
        ...question,
        checks: [{ kind: 'stale', text: 'Old semantic claim' }],
      })),
    }));
    const result = repositoryDeltaScopes({
      ...synthetic([file('b.ts', 'b')]),
      shardSize: 2,
      previousScopes: changed,
      previousInventory: initial.inventory.files,
    });
    expect(result.scopes[0]?.questions).toMatchObject([
      { id: 'investigate-2', path: 'b.ts', checks: [{ kind: 'investigation' }] },
    ]);
    expect(result.scopes[0]?.commit).toBe('b'.repeat(40));
  });
  it('does not infer ambiguous duplicate-blob renames or cross-language renames', () => {
    const old = [file('a.ts', 'same'), file('b.ts', 'same')];
    const previousScopes = repositoryScopes({
      ...synthetic(old).inventory,
      repo: 'org/repo',
      workspace: 'fixture',
      shardSize: 1,
    });
    const result = repositoryDeltaScopes({
      ...synthetic([file('c.ts', 'same')]),
      previousScopes,
      previousInventory: old,
    });
    expect(result.changes).toMatchObject({
      renamed: [],
      added: ['c.ts'],
      deleted: ['a.ts', 'b.ts'],
    });
    expect(result.scopes[0]?.id).toBe('repository-0003');
    const source = [file('a.ts', 'same')];
    const cross = repositoryDeltaScopes({
      ...synthetic([{ ...file('a.java', 'same'), language: 'java' }]),
      previousScopes: repositoryScopes({
        ...synthetic(source).inventory,
        repo: 'org/repo',
        workspace: 'fixture',
        shardSize: 1,
      }),
      previousInventory: source,
    });
    expect(cross.changes.renamed).toEqual([]);
  });
  it('is deterministic across inventory order and appends beyond a retired highest ID', () => {
    const old = [file('old.ts', 'old')];
    const previousScopes = repositoryScopes({
      ...synthetic(old).inventory,
      repo: 'org/repo',
      workspace: 'fixture',
      shardSize: 1,
    }).map((scope) => ({ ...scope, id: 'repository-0099' }));
    const current = [file('z.ts', 'new-z'), file('a.ts', 'new-a')];
    const result = repositoryDeltaScopes({
      ...synthetic(current),
      previousScopes,
      previousInventory: old,
    });
    const reversed = repositoryDeltaScopes({
      ...synthetic(current.toReversed()),
      previousScopes,
      previousInventory: old,
    });
    expect(result).toEqual(reversed);
    expect(result.scopes.map((scope) => scope.id)).toEqual(['repository-0100', 'repository-0101']);
    expect(result.retiredScopeIds).toEqual(['repository-0099']);
  });
  it('rejects duplicate predecessor ownership and reports mode changes as modifications', () => {
    const old = [file('a.ts', 'same')];
    const previousScopes = repositoryScopes({
      ...synthetic(old).inventory,
      repo: 'org/repo',
      workspace: 'fixture',
      shardSize: 1,
    });
    const duplicate = previousScopes.map((scope) => ({ ...scope, id: 'repository-0002' }));
    expect(() =>
      repositoryDeltaScopes({
        ...synthetic(old),
        previousScopes: [...previousScopes, ...duplicate],
        previousInventory: old,
      }),
    ).toThrow('membership');
    expect(() =>
      repositoryDeltaScopes({
        ...synthetic(old),
        previousScopes: [...previousScopes, ...previousScopes],
        previousInventory: old,
      }),
    ).toThrow('Duplicate repository scope number');
    const result = repositoryDeltaScopes({
      ...synthetic(old.map((entry) => ({ ...entry, mode: '100755' }))),
      previousScopes,
      previousInventory: old,
    });
    expect(result.changes.modified).toEqual(['a.ts']);
    expect(result.changes.unchanged).toEqual([]);
  });
  it('retires every empty scope without publishing an empty scope', () => {
    const input = synthetic([file('a.ts', 'same')]);
    const previousScopes = repositoryScopes({
      ...input.inventory,
      repo: input.repo,
      workspace: input.workspace,
      shardSize: 1,
    });
    expect(
      repositoryDeltaScopes({
        ...synthetic([]),
        previousScopes,
        previousInventory: input.inventory.files,
      }),
    ).toMatchObject({
      scopes: [],
      retiredScopeIds: ['repository-0001'],
      changes: { deleted: ['a.ts'] },
    });
  });
  it('rejects invalid bounds, incomplete predecessors and duplicate or foreign scope membership', () => {
    const input = synthetic([file('a.ts', 'a'), file('b.ts', 'b')]);
    const scopes = repositoryScopes({
      ...input.inventory,
      repo: input.repo,
      workspace: input.workspace,
      shardSize: 2,
    });
    expect(() => repositoryDeltaScopes({ ...input, shardSize: 0 })).toThrow('1 to 100');
    expect(() => repositoryDeltaScopes({ ...input, previousScopes: scopes })).toThrow(
      'supplied together',
    );
    expect(() =>
      repositoryDeltaScopes({
        ...input,
        previousScopes: [],
        previousInventory: input.inventory.files,
      }),
    ).toThrow('omit selected');
    expect(() =>
      repositoryDeltaScopes({
        ...input,
        previousScopes: scopes,
        previousInventory: input.inventory.files,
      }),
    ).toThrow('Retained scope exceeds');
    expect(() =>
      repositoryDeltaScopes({
        ...input,
        previousScopes: scopes.map((scope) => ({ ...scope, repo: 'foreign/repo' })),
        previousInventory: input.inventory.files,
      }),
    ).toThrow('authority');
    expect(() =>
      repositoryDeltaScopes({
        ...input,
        inventory: {
          ...input.inventory,
          files: [...input.inventory.files, input.inventory.files[0]!],
        },
      }),
    ).toThrow('Duplicate inventory');
  });
});
