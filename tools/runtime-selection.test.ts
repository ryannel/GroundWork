import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeBundle, KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators, snapshotFor } from '@/infrastructure/knowledge/knowledge-format';
import { importKnowledgeSnapshot } from '@/infrastructure/knowledge/knowledge-index';
import { verifyKnowledgeSelection } from '@/infrastructure/knowledge/knowledge-selection';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { softOfferInput } from './soft-offer-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'runtime-selection-'));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'review',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}
function selection(bundles: readonly KnowledgeBundle[]): {
  readonly manifest: ReturnType<typeof snapshotFor>;
  readonly bundles: readonly KnowledgeBundle[];
} {
  return { manifest: snapshotFor(bundles, 'knowledge-query/v3'), bundles };
}

describe('runtime snapshot publication', () => {
  it.each(['update', 'delete'] as const)(
    'retains %s acknowledgements in native consistency queries',
    async (mode) => {
      const parse = await knowledgeValidators();
      const records = bundle.records.map((record) =>
        record.id === 's2/write/save' && record.kind === 'storage_write'
          ? { ...record, mode }
          : record,
      );
      const input = selection([{ ...bundle, records }]);
      await expect(
        importKnowledgeSnapshot(path.join(directory, `${mode}.sqlite`), input),
      ).resolves.toBeUndefined();
      const reader = readerFor(records);
      const result = queryKnowledge(
        reader,
        runtimeRequest('soft-offer', reader.snapshot, { query: 'consistency' }),
      );
      expect(result.records.find((record) => record.id === 's2/write/save')).toMatchObject({
        mode,
        acknowledgement: 'normal_return',
      });
      const legacy = await softOfferInput();
      const previous = {
        ...legacy.bundle,
        records: legacy.bundle.records.map((record) =>
          record.id === 's2/write/save' && record.kind === 'storage_write'
            ? { ...record, mode }
            : record,
        ),
      };
      expect(() => parse.bundle(previous)).toThrow('/mode');
    },
  );
  it('rejects missing v3 source hosts at the import boundary', async () => {
    const records = bundle.records.map((record) => {
      if (record.kind !== 'evidence') return record;
      const { host, ...legacy } = record;
      expect(host).toBe('github.com');
      return legacy;
    });
    const input = selection([{ ...bundle, records }]);
    await expect(
      importKnowledgeSnapshot(path.join(directory, 'host.sqlite'), input),
    ).rejects.toThrow('v3 evidence requires a GitHub host');
  });
  it('checks duplicate runtime bindings across bundle boundaries', async () => {
    const binding = bundle.records.find((record) => record.id === 'u3/runs/s2-http');
    if (binding?.kind !== 'execution_binding') throw new Error('Missing runtime fixture');
    const duplicate = { ...binding, id: 'review/duplicate-execution' };
    const input = selection([bundle, { ...bundle, records: [duplicate] }]);
    expect(() => {
      verifyKnowledgeSelection(input);
    }).toThrow('duplicate implementation binding');
    await expect(
      importKnowledgeSnapshot(path.join(directory, 'duplicate.sqlite'), input),
    ).rejects.toThrow('duplicate implementation binding');
  });
  it('resolves legitimate references against the whole selected revision set', () => {
    const midpoint = Math.floor(bundle.records.length / 2);
    const bundles = [
      { ...bundle, records: bundle.records.slice(0, midpoint) },
      { ...bundle, records: bundle.records.slice(midpoint) },
    ];
    expect(() => {
      verifyKnowledgeSelection(selection(bundles));
    }).not.toThrow();
  });
});

describe('subscription runtime roots', () => {
  it('opens the consumer component and its downstream interactions directly', () => {
    const reader = readerFor(bundle.records);
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, { entry: 's2/subscription' }),
    );
    expect(result.nodes.map((node) => node.record)).toEqual([
      'u3/component/assortment-worker',
      'u3/component/commercial-topic',
      'u3/component/redis',
      'u3/component/blob',
    ]);
    expect(result.edges.filter((edge) => edge.on === 'consume')).toHaveLength(1);
    expect(result.nodes.some((node) => node.record === 'u3/component/mas')).toBe(false);
  });
  it('annotates a direct consumer trace with the explicit consumer execution', () => {
    const reader = readerFor(bundle.records);
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, {
        entry: 's2/subscription',
        query: 'trace',
      }),
    );
    expect(new Set(result.nodes.map((node) => node.component))).toEqual(
      new Set(['u3/component/assortment-worker']),
    );
    expect(new Set(result.nodes.map((node) => node.execution))).toEqual(
      new Set(['u3/runs/s2-consumer']),
    );
  });
  it('does not guess a subscription host when its consume binding is absent', () => {
    const reader = readerFor(
      bundle.records.filter((record) => record.id !== 'u3/interaction/consume'),
    );
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, { entry: 's2/subscription' }),
    );
    expect(result.nodes).toEqual([]);
    expect(result.frontiers[0]?.reason).toBe('binding_unresolved');
  });
});
