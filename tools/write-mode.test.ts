import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord, StorageWrite } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
const original = bundle.records.find((record) => record.id === 's2/write/save');
const gap = bundle.records.find((record) => record.kind === 'gap');
if (original?.kind !== 'storage_write' || gap === undefined) throw new Error('Missing fixture');
const write: StorageWrite = { ...original, mode: 'unknown', gaps: [gap.id] };

function recordsFor(replacement: StorageWrite): KnowledgeRecord[] {
  return bundle.records.map((record) => (record.id === write.id ? replacement : record));
}

function readerFor(records: KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'unknown-write-intent',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

describe('unknown storage write intent', () => {
  it('retains a proven save and acknowledgement without guessing its write mode', () => {
    expect(checkKnowledge(parse.bundle({ ...bundle, records: recordsFor(write) }))).toEqual([]);
  });

  it('requires an explicit gap for the unresolved mode', () => {
    expect(() => parse.bundle({ ...bundle, records: recordsFor({ ...write, gaps: [] }) })).toThrow(
      /fewer than 1 items/u,
    );
  });

  it('serves payload fields, staging and normal-return acknowledgement in consistency queries', () => {
    const reader = readerFor(recordsFor(write));
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, { query: 'consistency' }),
    );
    expect(result.records.find((record) => record.id === write.id)).toEqual(write);
    expect(result.records.some((record) => record.id === write.stagedAt)).toBe(true);
    expect(result.records.some((record) => record.id === write.acknowledgedAt)).toBe(true);
    expect(result.limitsHit).toEqual([]);
  });

  it('leaves archived write modes unchanged', () => {
    const archived = { ...bundle, format: 'groundwork-knowledge/v2', records: [original] };
    expect(() => parse.bundle(archived)).not.toThrow();
    expect(() => parse.bundle({ ...archived, records: [write] })).toThrow(/allowed values/u);
  });
});
