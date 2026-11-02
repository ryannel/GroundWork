import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { scanRepository } from './scan-repository';
import { repositoryInventory } from './scan-repository-inventory';
import { repositoryScopes } from './scan-repository-scope';

vi.mock(import('server-only'), () => ({}));

function git(repository: string, args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['-C', repository, ...args], {
    encoding: 'utf8',
    env: { NODE_ENV: 'test', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'scan-repository-'));
  const repository = path.join(directory, 'example', 'app');
  mkdirSync(path.join(repository, 'test'), { recursive: true });
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.name', 'Fixture']);
  git(repository, ['config', 'user.email', 'fixture@example.test']);
  writeFileSync(path.join(repository, 'main.ts'), 'export function route() { return 1; }');
  writeFileSync(
    path.join(repository, 'test', 'main.test.ts'),
    'export function testRoute() { return 2; }',
  );
  writeFileSync(path.join(repository, 'settings.xml'), '<settings/>');
  writeFileSync(path.join(repository, 'binary.jar'), Buffer.from([0, 255, 23]));
  git(repository, ['add', '.']);
  git(repository, ['commit', '-qm', 'Fixture']);
  return { directory, repository, commit: git(repository, ['rev-parse', 'HEAD']) };
}

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8'));
}

describe('repository scan orchestration', () => {
  it('retains bundled Yarn in the denominator without parsing package-manager implementation', () => {
    const input = fixture();
    try {
      mkdirSync(path.join(input.repository, '.yarn/releases'), { recursive: true });
      writeFileSync(
        path.join(input.repository, '.yarn/releases/yarn-4.18.0.cjs'),
        'bundled runtime',
      );
      writeFileSync(path.join(input.repository, 'yarn-app.cjs'), 'exports.application = true;');
      git(input.repository, ['add', '.']);
      git(input.repository, ['commit', '-qm', 'Bundled package manager']);
      const inventory = repositoryInventory(input.repository);
      expect(inventory.files).toHaveLength(6);
      expect(inventory.files.find((file) => file.path.includes('.yarn/releases/'))).toMatchObject({
        selectedForParsing: false,
        language: null,
        category: 'ancillary',
      });
      expect(
        inventory.files.find((file) => file.path.includes('.yarn/releases/'))?.reason,
      ).toContain('Bundled Yarn');
      expect(inventory.files.find((file) => file.path === 'yarn-app.cjs')).toMatchObject({
        selectedForParsing: true,
        language: 'javascript',
      });
    } finally {
      rmSync(input.directory, { recursive: true, force: true });
    }
  });
  it('inventories the pinned tree independently of dirty files and bounds every manifest', () => {
    const input = fixture();
    try {
      writeFileSync(path.join(input.repository, 'untracked.ts'), 'untracked');
      writeFileSync(path.join(input.repository, 'main.ts'), 'dirty');
      const inventory = repositoryInventory(input.repository, input.commit);
      expect(inventory.files).toHaveLength(4);
      expect(inventory.files.map((file) => file.category)).toEqual([
        'binary',
        'source',
        'ancillary',
        'test',
      ]);
      const scopes = repositoryScopes({
        ...inventory,
        repo: 'example/app',
        workspace: 'example',
        shardSize: 1,
      });
      expect(scopes).toHaveLength(2);
      expect(scopes.map((scope) => scope.files.length)).toEqual([1, 1]);
      expect(scopes[0]).toMatchObject({
        commit: input.commit,
        ref: 'HEAD',
        questions: [{ symbol: '' }],
      });
      expect(() =>
        repositoryScopes({
          ...inventory,
          repo: 'example/app',
          workspace: 'example',
          shardSize: 101,
        }),
      ).toThrow('1 to 100');
    } finally {
      rmSync(input.directory, { recursive: true, force: true });
    }
  });

  it('publishes cold/warm shards, retains ancillary bytes and observes moved local HEAD', async () => {
    const input = fixture();
    const output = path.join(input.directory, 'output');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {
      // Progress output is asserted through the saved report instead.
    });
    try {
      writeFileSync(
        path.join(input.repository, 'main.ts'),
        'export function route() { return 3; }',
      );
      git(input.repository, ['add', '.']);
      git(input.repository, ['commit', '-qm', 'Move HEAD']);
      await scanRepository(['example/app', input.directory, output, '--commit', input.commit]);
      expect(readJson(path.join(output, 'inventory.json'))).toMatchObject({
        denominator: 4,
        sourceFiles: 1,
        testFiles: 1,
        unparsedFiles: 2,
        ancillary: { retainedTextFiles: 1, excludedFiles: 1, blobReads: 2 },
      });
      expect(readJson(path.join(output, 'repository.json'))).toMatchObject({
        status: 'partial',
        cacheMode: 'empty',
        selectedFiles: 2,
        shardCount: 1,
      });
      expect(readJson(path.join(output, 'repository-0001', 'cold-metrics.json'))).toMatchObject({
        extraction: { stats: { parsedFiles: 2, blobReads: 2 } },
        freshness: { sourceUnchanged: false },
        publicValidation: 'passed',
        semanticAcceptance: 'not-established',
      });
      expect(readJson(path.join(output, 'repository-0001', 'warm-metrics.json'))).toMatchObject({
        extraction: { stats: { parsedFiles: 0, blobReads: 0, indexHits: 2 } },
      });
      const regenerated = path.join(input.directory, 'regenerated');
      await scanRepository([
        'example/app',
        input.directory,
        regenerated,
        '--commit',
        input.commit,
        '--cache',
        path.join(output, 'cache'),
      ]);
      expect(readJson(path.join(regenerated, 'repository.json'))).toMatchObject({
        cacheMode: 'reused_source_index',
      });
      expect(
        readJson(path.join(regenerated, 'repository-0001', 'first-metrics.json')),
      ).toMatchObject({
        trial: 'first',
        extraction: { stats: { parsedFiles: 0, blobReads: 0, indexHits: 2 } },
      });
      expect(
        readJson(path.join(regenerated, 'repository-0001', 'warm-metrics.json')),
      ).toMatchObject({
        trial: 'warm',
        extraction: { stats: { parsedFiles: 0, blobReads: 0, indexHits: 2 } },
      });
      await expect(scanRepository(['example/app', input.directory, output])).rejects.toThrow(
        'EEXIST',
      );
    } finally {
      log.mockRestore();
      rmSync(input.directory, { recursive: true, force: true });
    }
  }, 15_000);
});
