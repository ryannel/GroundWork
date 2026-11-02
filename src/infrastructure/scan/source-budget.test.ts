import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureGit } from './freshness-git-fixture';
import type { ScanScope } from './scan-scope';
import { readCachedIndex, readCachedSource } from './scoped-source-cache';
import { pinnedMetadata, readPinnedSource } from './scoped-source-git';
import { scopedProvenance } from './scoped-source-provenance';
import { runScopedSources } from './scoped-source-store';
import {
  assertSourceBudget,
  DEFAULT_MAX_SOURCE_BYTES,
  sourceByteLimit,
  SourceBudgetError,
} from './source-budget';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./scoped-source-cache'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    readCachedIndex: vi.fn<typeof original.readCachedIndex>(original.readCachedIndex),
    readCachedSource: vi.fn<typeof original.readCachedSource>(original.readCachedSource),
  };
});
vi.mock(import('./scoped-source-git'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    readPinnedSource: vi.fn<typeof original.readPinnedSource>(original.readPinnedSource),
  };
});
const folders: string[] = [];
afterEach(() => {
  vi.clearAllMocks();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture(files: Readonly<Record<string, string>>) {
  const root = mkdtempSync(path.join(tmpdir(), 'source-budget-'));
  folders.push(root);
  const repository = path.join(root, 'org', 'repo');
  mkdirSync(repository, { recursive: true });
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  const baseline = fixtureCommit(repository, files);
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'budget',
    repo: 'org/repo',
    commit: baseline.commit,
    ref: 'HEAD',
    files: Object.keys(files).map((filename) => ({
      path: filename,
      language: 'typescript',
      environment: 'server',
    })),
    questions: [
      {
        id: 'action',
        profile: 'action',
        path: Object.keys(files)[0] ?? '',
        symbol: '',
        checks: [],
      },
    ],
  };
  return {
    repository,
    scope,
    options: { authority: 'fixture', cloneRoot: root, cacheDirectory: path.join(root, 'cache') },
  };
}

describe('selected source byte budget', () => {
  it('accepts the exact bound and rejects unsafe limit and size metadata', () => {
    expect(sourceByteLimit()).toBe(DEFAULT_MAX_SOURCE_BYTES);
    expect(() => {
      assertSourceBudget({ path: 'x', blob: 'a', bytes: 32 }, 32);
    }).not.toThrow();
    for (const limit of [0, -1, 1.5, Number.NaN, Infinity, 33_554_433]) {
      expect(() => sourceByteLimit(limit)).toThrow('Source byte limit must be');
    }
    for (const bytes of [-1, Number.NaN, 1.5]) {
      expect(() => {
        assertSourceBudget({ path: 'x', blob: 'a', bytes });
      }).toThrow('Invalid pinned source size');
    }
  });
  it('returns path, blob, actual byte size and limit as a typed error', () => {
    expect(() => {
      assertSourceBudget({ path: 'large.ts', blob: 'a'.repeat(40), bytes: 33 }, 32);
    }).toThrow(SourceBudgetError);
    const error = new SourceBudgetError({ path: 'large.ts', blob: 'a'.repeat(40), bytes: 33 }, 32);
    expect(error).toMatchObject({
      code: 'SOURCE_BUDGET_EXCEEDED',
      path: 'large.ts',
      blob: 'a'.repeat(40),
      bytes: 33,
      limit: 32,
    });
  });
  it('checks every selected file before the first cache or blob read', async () => {
    const input = fixture({
      'small.ts': 'export const x=1;',
      'large.ts': ' '.repeat(DEFAULT_MAX_SOURCE_BYTES + 1),
    });
    const cachedIndex = vi.mocked(readCachedIndex);
    const cachedSource = vi.mocked(readCachedSource);
    const blob = vi.mocked(readPinnedSource);
    await expect(runScopedSources(input.scope, input.options)).rejects.toMatchObject({
      code: 'SOURCE_BUDGET_EXCEEDED',
      path: 'large.ts',
      bytes: DEFAULT_MAX_SOURCE_BYTES + 1,
      limit: DEFAULT_MAX_SOURCE_BYTES,
    });
    expect(cachedIndex).not.toHaveBeenCalled();
    expect(cachedSource).not.toHaveBeenCalled();
    expect(blob).not.toHaveBeenCalled();
  });
  it('does not bypass a reduced budget through a retained index', async () => {
    const input = fixture({ 'source.ts': 'export function action() { return 1; }' });
    await runScopedSources(input.scope, input.options);
    const cachedIndex = vi.mocked(readCachedIndex).mockClear();
    const blob = vi.mocked(readPinnedSource).mockClear();
    await expect(
      runScopedSources(input.scope, { ...input.options, maxSourceBytes: 8 }),
    ).rejects.toBeInstanceOf(SourceBudgetError);
    expect(cachedIndex).not.toHaveBeenCalled();
    expect(blob).not.toHaveBeenCalled();
  });
  it('uses byte sizes for multibyte source and preserves unusual pinned paths', () => {
    const filename = 'line\nand\ttab.ts';
    const input = fixture({ [filename]: '// é' });
    const metadata = pinnedMetadata(input.repository, input.scope);
    expect(metadata.sizes.get(filename)).toBe(Buffer.byteLength('// é'));
    expect(() => {
      assertSourceBudget(
        {
          path: filename,
          blob: metadata.blobs.get(filename) ?? '',
          bytes: metadata.sizes.get(filename) ?? -1,
        },
        '// é'.length,
      );
    }).toThrow(SourceBudgetError);
  });
  it('fingerprints the normalised policy without changing parser identity', () => {
    const input = fixture({ 'source.ts': 'export const x=1;' });
    const baseline = scopedProvenance(input.scope, input.options);
    expect(
      scopedProvenance(input.scope, { ...input.options, maxSourceBytes: DEFAULT_MAX_SOURCE_BYTES }),
    ).toEqual(baseline);
    const changed = scopedProvenance(input.scope, {
      ...input.options,
      maxSourceBytes: DEFAULT_MAX_SOURCE_BYTES * 2,
    });
    expect(changed.configDigest).not.toBe(baseline.configDigest);
    expect(changed.toolchainDigest).toBe(baseline.toolchainDigest);
  });
});
