import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { expect, it, vi } from 'vitest';

import { migratedEvidenceId } from '@/../tools/migrate-model/evidence';
import { repositoryInventory } from '@/../tools/scan-repository-inventory';
import { passFixture } from '@/../tools/scan-repository-pass-fixture';

import { citedAnalysis } from './analysis';

vi.mock(import('server-only'), () => ({}));

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

it('promotes only cited analysis and verifies its source and the cache receipt', async () => {
  const filePath = 'order.ts';
  const fixture = passFixture({
    [filePath]: 'export const orders = [];\nexport const count = orders.length;\n',
  });
  try {
    const inventory = repositoryInventory(fixture.repository);
    const blob = inventory.files[0]?.blob;
    if (blob === undefined) throw new Error('Missing pinned test file.');
    const repo = 'org/repo';
    const migrated = (id: string): string => migratedEvidenceId(repo, id);
    const source = {
      kind: 'source',
      id: 'source:confirmed',
      host: 'host:orders',
      path: filePath,
      blob,
      lines: [1, 2],
      authority: 'declared',
    };
    const gap = {
      kind: 'gap',
      id: 'gap:confirmed',
      reason: 'missing_dependency',
      source: source.id,
      description: 'The observed call target is unresolved.',
    };
    const host = migrated(source.host);
    const file = { kind: 'file' as const, id: 'ev:order-file', path: filePath, blob };
    const sourceLines = `${JSON.stringify(source)}\n`;
    const gapLines = `${JSON.stringify(gap)}\n${JSON.stringify({ ...gap, id: 'gap:unrelated' })}\n`;
    await writeFile(path.join(fixture.root, 'sources.jsonl.gz'), gzipSync(sourceLines));
    await writeFile(path.join(fixture.root, 'gaps.jsonl'), gapLines);
    const receipt = path.join(fixture.root, 'receipt.json');
    await writeFile(
      receipt,
      JSON.stringify({
        format: 'groundwork-analysis-cache/v1',
        repo,
        commit: inventory.commit,
        files: { sources: sha(sourceLines), gaps: sha(gapLines) },
      }),
    );
    const request = {
      repo,
      repository: fixture.repository,
      commit: inventory.commit,
      requested: [migrated(gap.id)],
      files: new Map([[filePath, file]]),
      hosts: new Set([host]),
    };
    const present = new Set([host, file.id]);
    const promoted = await citedAnalysis({ ...request, receipt, present });
    expect(promoted.map(({ value }) => value.id)).toEqual(
      expect.arrayContaining([migrated(gap.id), migrated(source.id)]),
    );
    expect(promoted).toHaveLength(2);
    expect(promoted.find(({ family }) => family === 'sources')?.value).toMatchObject({
      file: file.id,
      host,
      lines: [1, 2],
    });
    expect(promoted.find(({ family }) => family === 'gaps')?.value.source).toBe(
      migrated(source.id),
    );
    await expect(
      citedAnalysis({
        ...request,
        present: new Set([...present, ...promoted.map(({ value }) => value.id)]),
      }),
    ).resolves.toEqual([]);
    await expect(citedAnalysis({ ...request, receipt, present, hosts: new Set() })).rejects.toThrow(
      /no verified file and host/u,
    );
    await writeFile(path.join(fixture.root, 'gaps.jsonl'), '');
    await expect(citedAnalysis({ ...request, receipt, present })).rejects.toThrow(
      /cache file changed/u,
    );
  } finally {
    fixture.dispose();
  }
});
