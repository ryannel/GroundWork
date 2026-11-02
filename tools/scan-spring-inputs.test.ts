import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import type { runScopedSources, ScopedSources } from '@/infrastructure/scan/scoped-source-store';

import { springBindingInputs } from './scan-spring-inputs';
import type { springConfigurationResources, springGraphqlResources } from './scan-spring-resources';

const mocks = vi.hoisted(() => ({
  scope: vi.fn<(filename: string) => Promise<ScanScope>>(),
  run: vi.fn<typeof runScopedSources>(),
}));
vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/infrastructure/scan/scan-scope'), () => ({ readScanScope: mocks.scope }));
vi.mock(import('@/infrastructure/scan/scoped-source-store'), () => ({
  runScopedSources: mocks.run,
}));
vi.mock(import('./scan-spring-resources'), () => {
  const resources = {
    bindings: [],
    sources: [],
    gaps: [],
    statistics: { metadataSizeReads: 0, blobReads: 0, retainedCacheHits: 0 },
  };
  return {
    springGraphqlResources: vi.fn<typeof springGraphqlResources>().mockResolvedValue(resources),
    springConfigurationResources: vi
      .fn<typeof springConfigurationResources>()
      .mockResolvedValue(resources),
  };
});

function scopedFile(sourcePath: string): ScopedSources['sources'][number] {
  return {
    file: { path: sourcePath, language: 'java', environment: 'server' },
    blob: 'b'.repeat(40),
    index: {
      path: sourcePath,
      language: 'java',
      digest: 'digest',
      content: '',
      parser: 'fixture',
      attribution: 'parse_only',
      options: '',
      nodes: [],
      diagnostics: [],
    },
    facts: {
      summaries: [],
      sources: [],
      gaps: [],
      candidates: [],
      parser: 'fixture',
      attribution: 'parse_only',
    },
  };
}

const scope: ScanScope = {
  format: 'scan-scope/v1',
  workspace: 'fixture',
  id: 'one',
  repo: 'fixture/repo',
  commit: 'a'.repeat(40),
  ref: 'HEAD',
  files: [{ path: 'core/src/main/java/App.java', language: 'java', environment: 'server' }],
  questions: [
    {
      id: 'q',
      profile: 'endpoint',
      path: 'core/src/main/java/App.java',
      symbol: 'run',
      checks: [{ kind: 'handler', text: 'run' }],
    },
  ],
};
let capture = '';
const options = () => ({ capture, cloneRoot: '/clone', cache: '/cache' });

beforeEach(async () => {
  vi.clearAllMocks();
  capture = await mkdtemp(path.join(os.tmpdir(), 'binding-inputs-'));
  await Promise.all(
    ['repository-002', 'ignored', 'repository-001'].map(async (name) =>
      mkdir(path.join(capture, name)),
    ),
  );
});
afterEach(async () => rm(capture, { recursive: true, force: true }));

describe('Spring binding manifest scope', () => {
  it('includes root and module production paths but excludes tests and misleading prefixes', async () => {
    mocks.scope.mockResolvedValue(scope);
    mocks.run.mockResolvedValue({
      sources: [
        'src/main/java/Root.java',
        'core/src/main/java/Module.java',
        'src/test/java/Test.java',
        'core/src/test/java/ModuleTest.java',
        'other-src/main/java/Decoy.java',
      ].map(scopedFile),
      stats: { blobReads: 0, parsedFiles: 0, indexHits: 5, reusedFiles: 5, sourceBytes: 0 },
      baseline: {
        repo: scope.repo,
        commit: scope.commit,
        tree: 'c'.repeat(40),
        ref: scope.ref,
        environmentDigest: 'environment',
        ruleDigest: 'rules',
        toolchainDigest: 'parser',
        configDigest: 'configuration',
      },
    });
    const inputs = await springBindingInputs(options());
    expect(inputs.indexes.map((index) => index.path)).toEqual([
      'src/main/java/Root.java',
      'core/src/main/java/Module.java',
      'src/main/java/Root.java',
      'core/src/main/java/Module.java',
    ]);
  });
  it.each([{ repo: 'another/repo' }, { commit: 'b'.repeat(40) }])(
    'rejects mixed pins before reading or parsing source: %j',
    async (difference) => {
      mocks.scope.mockResolvedValueOnce(scope).mockResolvedValueOnce({ ...scope, ...difference });
      await expect(springBindingInputs(options())).rejects.toThrow(
        'must share one repository and commit',
      );
      expect(mocks.scope).toHaveBeenCalledTimes(2);
      expect(mocks.run).not.toHaveBeenCalled();
    },
  );
  it('rejects an empty capture before reading repository source', async () => {
    await Promise.all(
      ['repository-001', 'repository-002'].map(async (name) =>
        rm(path.join(capture, name), { recursive: true }),
      ),
    );
    await expect(springBindingInputs(options())).rejects.toThrow('No repository scopes');
    expect(mocks.scope).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
