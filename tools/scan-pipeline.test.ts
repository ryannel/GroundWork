import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { parseScanScope } from '@/infrastructure/scan/scan-scope';
import { assertScopeCoverage } from '@/infrastructure/scan/scope-coverage';
import { scopedDocument } from '@/infrastructure/scan/scoped-document';
import { publishScopedScan } from '@/infrastructure/scan/scoped-publication';
import type { ScopedSources } from '@/infrastructure/scan/scoped-source-store';
import { indexSource } from '@/infrastructure/scan/source-index';

import { scanArguments } from './scan-cli-args';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
const commit = 'a'.repeat(40);
const scope = parseScanScope({
  format: 'scan-scope/v1',
  workspace: 'fixture',
  id: 'fixture',
  repo: 'org/repo',
  commit,
  ref: 'HEAD',
  files: [{ path: 'handler.ts', language: 'typescript', environment: 'server' }],
  questions: [
    {
      id: 'handler',
      profile: 'endpoint',
      path: 'handler.ts',
      symbol: 'handler',
      checks: [{ kind: 'control', text: 'Which branch returns?' }],
    },
  ],
});

function selectedSources(): ScopedSources {
  const file = scope.files[0];
  if (!file) throw new Error('Missing fixture file');
  const index = indexSource({
    path: file.path,
    language: file.language,
    content: 'export function handler(input: boolean) { if (input) return 1; return 2; }',
  });
  const facts = extractLocalFacts(index, {
    repo: scope.repo,
    commit,
    host: 'host:545e51f25786e141',
    blob: 'b'.repeat(40),
  });
  return {
    sources: [{ file, index, facts, blob: 'b'.repeat(40) }],
    stats: { blobReads: 1, parsedFiles: 1, indexHits: 0, reusedFiles: 0, sourceBytes: 88 },
    baseline: {
      repo: scope.repo,
      commit,
      tree: 'c'.repeat(40),
      ref: scope.ref,
      environmentDigest: 'environment',
      configDigest: 'configuration',
      ruleDigest: 'rules',
      toolchainDigest: 'compiler',
    },
  };
}

afterEach(async () => {
  await Promise.all(
    folders.splice(0).map(async (folder) => rm(folder, { recursive: true, force: true })),
  );
});

describe('scoped scan boundaries and publication', () => {
  it('rejects unsafe repositories, duplicate inputs and questions outside the selected files', () => {
    expect(() => parseScanScope({ ...scope, repo: '../repo' })).toThrow('organisation');
    expect(() => parseScanScope({ ...scope, files: [...scope.files, ...scope.files] })).toThrow(
      'Duplicate',
    );
    expect(() =>
      parseScanScope({ ...scope, questions: [{ ...scope.questions[0], path: 'other.ts' }] }),
    ).toThrow('outside');
  });

  it('requires each independently expected question exactly once and pins every source', () => {
    const document = scopedDocument(scope, selectedSources());
    expect(() => {
      assertScopeCoverage(scope, document);
    }).not.toThrow();
    expect(() => {
      assertScopeCoverage(scope, { ...document, receipts: [] });
    }).toThrow('Missing');
    expect(() => {
      assertScopeCoverage(scope, {
        ...document,
        receipts: [...document.receipts, ...document.receipts],
      });
    }).toThrow('duplicate');
    expect(() => {
      assertScopeCoverage(scope, {
        ...document,
        sources: document.sources.map((source) => ({ ...source, commit: 'other' })),
      });
    }).toThrow('pinned');
  });

  it('rejects unknown or repeated options rather than silently widening the scan', () => {
    expect(() => scanArguments(['--all', 'true'])).toThrow('Unknown');
    expect(() => scanArguments(['--cache', 'cache-a', '--cache', 'cache-b'])).toThrow('repeated');
    expect(() => scanArguments(['--java'])).toThrow('incomplete');
    expect(scanArguments(['scope.json', 'clones', 'output', '--cache', 'cache-a'])).toMatchObject({
      cache: 'cache-a',
      positionals: ['scope.json', 'clones', 'output'],
    });
  });

  it('publishes identical generations idempotently and preserves the last selection after a corrupt generation', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'scan-publication-'));
    folders.push(directory);
    const result = selectedSources();
    const host = result.sources[0]?.facts.sources[0]?.host;
    const document = scopedDocument(scope, result);
    expect(host).toBe(document.hosts[0]?.id);
    const first = await publishScopedScan(directory, { scope, result });
    const pointer = await readFile(path.join(directory, 'selection.json'), 'utf8');
    const wrongBaseline = { ...result, baseline: { ...result.baseline, commit: 'd'.repeat(40) } };
    await expect(publishScopedScan(directory, { scope, result: wrongBaseline })).rejects.toThrow(
      'baseline',
    );
    await expect(readFile(path.join(directory, 'selection.json'), 'utf8')).resolves.toBe(pointer);
    const repeated = await publishScopedScan(directory, { scope, result });
    expect(repeated.generation).toBe(first.generation);
    await writeFile(path.join(directory, first.generation, 'document.json'), '{}');
    await expect(publishScopedScan(directory, { scope, result })).rejects.toThrow('EEXIST');
    await expect(readFile(path.join(directory, 'selection.json'), 'utf8')).resolves.toBe(pointer);
  });
});
