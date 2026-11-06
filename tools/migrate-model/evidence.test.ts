import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { migrateEvidence } from './evidence';
import { migrationReview, reviewSummary } from './review';

vi.mock(import('server-only'), () => ({}));

async function input(root: string): Promise<string> {
  const source = path.join(root, 'original');
  const folder = path.join(source, 'evidence/orders');
  await mkdir(folder, { recursive: true });
  const repository = {
    format: 'groundwork-evidence/v1',
    repo: 'example/orders',
    commit: 'a'.repeat(40),
    scannedAt: '2026-10-26 12:49:46 UTC',
    language: 'typescript',
    trackedFiles: 1,
    selectedFiles: 1,
    passes: ['source'],
  };
  await writeFile(path.join(folder, 'repository.json'), JSON.stringify(repository));
  await writeFile(
    path.join(folder, 'discovery.json'),
    JSON.stringify({
      readiness: 'blocked',
      coverage: 'unknown',
      scopes: ['orders'],
      sourceDeclaredComponents: [],
      actionHosts: [],
      knowledgeGaps: ['No caller is proved.'],
      unresolvedCandidates: [],
    }),
  );
  const families = {
    files: [
      { kind: 'file', id: 'file:src/Orders.ts', path: 'src/Orders.ts', blob: 'b'.repeat(40) },
    ],
    sources: [
      {
        kind: 'source',
        id: 'source:orders',
        host: 'ev:unknown-host',
        path: 'src/Orders.ts',
        blob: 'b'.repeat(40),
        lines: [3, 8],
        authority: 'declared',
      },
    ],
    contracts: [
      {
        kind: 'contract',
        id: 'contract:order',
        shape: { kind: 'scalar', name: 'string', spelling: 'string' },
        support: ['source:orders'],
      },
    ],
    claims: [
      {
        id: 'evidence',
        kind: 'finding',
        label: 'Inferred',
        statement: 'A retained legacy assertion.',
        evidence: ['source:orders'],
      },
    ],
  };
  for (const [name, values] of Object.entries(families)) {
    await writeFile(
      path.join(folder, `${name}.jsonl`),
      `${values.map((record) => JSON.stringify(record)).join('\n')}\n`,
    );
  }
  return source;
}
async function records(out: string, family: string): Promise<readonly unknown[]> {
  const text = await readFile(path.join(out, 'evidence/orders', `${family}.jsonl`), 'utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
}
describe('migration of existing evidence', () => {
  it('keeps source locations through file refs, preserves the pin and never fills missing claim metadata', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'groundwork-evidence-migration-'));
    const source = await input(root);
    const original = await readFile(path.join(source, 'evidence/orders/claims.jsonl'), 'utf8');
    const out = path.join(root, 'converted');
    const review = migrationReview();
    const ids = await migrateEvidence(source, out, review);
    await expect(
      readFile(path.join(out, 'evidence/orders/discovery.json'), 'utf8').then((text) =>
        JSON.parse(text),
      ),
    ).resolves.toEqual({
      kind: 'discovery',
      discovery_readiness: 'blocked',
      investigation_coverage: 'unknown',
      scopes: ['orders'],
      source_declared_components: [],
      action_hosts: [],
      knowledge_gaps: ['No caller is proved.'],
      unresolved_candidates: [],
    });
    await expect(records(out, 'sources')).resolves.toEqual([
      {
        kind: 'source',
        id: ids.get('source:orders'),
        host: 'ev:unknown-host',
        file: ids.get('file:src/Orders.ts'),
        lines: [3, 8],
        authority: 'declared',
      },
    ]);
    await expect(records(out, 'contracts')).resolves.toEqual([
      {
        kind: 'contract',
        id: ids.get('contract:order'),
        shape: { kind: 'scalar', name: 'string', spelling: 'string' },
        cites: [ids.get('source:orders')],
      },
    ]);
    await expect(records(out, 'claims')).resolves.toEqual([]);
    expect(review.rows().evidence?.[0]?.original).toEqual(JSON.parse(original));
    expect(review.rows().evidence?.[0]?.converted).toHaveProperty('evidence');
    expect(modelRecord(reviewSummary(review.rows()).families)?.evidence).toEqual({
      total: 1,
      pending: 1,
    });
    await expect(records(out, 'gaps')).resolves.toEqual([
      expect.objectContaining({ kind: 'gap', source: ids.get('evidence'), reason: 'unsupported' }),
    ]);
    const gapCheck = await modelValidator('evidence', 'gaps');
    expect(modelList(await records(out, 'gaps')).every((gap) => gapCheck(gap))).toBe(true);
    const metadata: unknown = JSON.parse(
      await readFile(path.join(out, 'evidence/orders/repository.json'), 'utf8'),
    );
    expect(metadata).toMatchObject({
      commit: 'a'.repeat(40),
      scannedAt: '2026-10-26T12:49:46Z',
      format: 'groundwork-evidence/v2',
    });
    await expect(readFile(path.join(source, 'evidence/orders/claims.jsonl'), 'utf8')).resolves.toBe(
      original,
    );
  });
  it('writes byte-identical output with the same input and leaves the source unchanged', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'groundwork-evidence-repeat-'));
    const source = await input(root);
    const first = path.join(root, 'first');
    const second = path.join(root, 'second');
    await migrateEvidence(source, first, migrationReview());
    await migrateEvidence(source, second, migrationReview());
    const names = await readdir(path.join(first, 'evidence/orders'));
    const pairs = await Promise.all(
      names.map(async (name) => [
        await readFile(path.join(first, 'evidence/orders', name), 'utf8'),
        await readFile(path.join(second, 'evidence/orders', name), 'utf8'),
      ]),
    );
    expect(pairs.every(([before, after]) => before === after)).toBe(true);
  });
});
