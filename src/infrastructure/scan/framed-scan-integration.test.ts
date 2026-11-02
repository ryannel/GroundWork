import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { writeFramedScanDocument } from './framed-scan-document';
import { framedScanManifest } from './framed-scan-format';
import { passArtifactDigest } from './repository-pass-files';
import type { ScanScope } from './scan-scope';
import { currentScopedGeneration } from './scoped-selection';
import { sourceDigest } from './source-index';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
it('retains logical generation hashing while physical checkpoints commit every frame page', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'scan-frame-generation-'));
  folders.push(directory);
  const baseline = {
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    ref: 'HEAD',
    environmentDigest: 'environment',
    ruleDigest: 'rules',
    toolchainDigest: 'tools',
    configDigest: 'config',
  };
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'fixture',
    repo: baseline.repo,
    commit: baseline.commit,
    ref: 'HEAD',
    files: [{ path: 'handler.ts', language: 'typescript', environment: 'server' }],
    questions: [
      {
        id: 'handler',
        profile: 'endpoint',
        path: 'handler.ts',
        symbol: 'handler',
        checks: [{ kind: 'call', text: 'Inspect source' }],
      },
    ],
  };
  const original = scanFixture();
  const document = {
    ...original,
    sources: original.sources.map((source) => ({ ...source, commit: baseline.commit })),
  };
  const outputs = [
    ['document.json', document],
    ['baseline.json', baseline],
    ['scope.json', scope],
    ['coverage.json', { scope: scope.id }],
  ] as const;
  const generation = sourceDigest(JSON.stringify(outputs));
  const folder = path.join(directory, generation);
  mkdirSync(folder);
  await Promise.all(
    outputs.map(async ([name, value]) => {
      const filename = path.join(folder, name);
      if (name === 'document.json') {
        await writeFramedScanDocument(filename, value, { forceFraming: true });
      } else writeFileSync(filename, JSON.stringify(value));
    }),
  );
  writeFileSync(
    path.join(directory, 'selection.json'),
    JSON.stringify({
      format: 'scan-selection/v1',
      generation,
      document: document.id,
      source: baseline,
    }),
  );
  await expect(currentScopedGeneration(directory, { scope, baseline })).resolves.toBe(generation);
  const filename = path.join(folder, 'document.json');
  const storage = readFileSync(filename, 'utf8');
  await expect(passArtifactDigest(folder, 'document.json')).resolves.toBe(sourceDigest(storage));
  const manifest = framedScanManifest.parse(JSON.parse(storage));
  const collection = manifest.entries.find((entry) => entry.kind === 'collection');
  if (collection?.kind !== 'collection' || collection.pages[0] === undefined) {
    throw new Error('Missing test frame page');
  }
  writeFileSync(path.join(folder, collection.pages[0].path), '{}');
  await expect(passArtifactDigest(folder, 'document.json')).rejects.toThrow('byte/hash mismatch');
  await expect(currentScopedGeneration(directory, { scope, baseline })).resolves.toBeNull();
});
