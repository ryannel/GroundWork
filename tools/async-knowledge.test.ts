import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { handoffMatch } from '@/domain/knowledge/handoff-match';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators, snapshotFor } from '@/infrastructure/knowledge/knowledge-format';
import { importKnowledgeSnapshot } from '@/infrastructure/knowledge/knowledge-index';

import { softOfferInput, softOfferRequest } from './soft-offer-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await softOfferInput();
const parse = await knowledgeValidators();
function revised(change: (record: KnowledgeRecord) => KnowledgeRecord): KnowledgeRecord[] {
  return bundle.records.map(change);
}
function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'test-snapshot',
    rules: 'knowledge-query/v2',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}
function match(records: readonly KnowledgeRecord[]): string | null {
  const reader = readerFor(records);
  const handoff = reader.get('s2/handoff');
  if (handoff?.kind !== 'handoff') throw new Error('Missing fixture handoff');
  return handoffMatch(reader.get, handoff, 'production-profile');
}
function problems(records: readonly KnowledgeRecord[]): string {
  return checkKnowledge({ ...bundle, records: [...records] }).join('\n');
}

describe('asynchronous matching boundaries', () => {
  it('requires the same namespace as well as topic name', () => {
    const records = revised((record) =>
      record.id === 's2/channel/consumer' && record.kind === 'channel_binding'
        ? { ...record, namespace: 'different-cluster:9092' }
        : record,
    );
    expect(match(records)).toContain('namespace');
    expect(problems(records)).toContain('namespace');
    const reader = readerFor(records);
    const result = queryKnowledge(reader, softOfferRequest(reader.snapshot));
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
    expect(result.nodes.some((node) => node.record === 's2/consumer.receive')).toBe(false);
  });
  it('requires compatible field tags, scalar types, nested shapes and envelope name', () => {
    const tags = revised((record) =>
      record.id === 's2/shape/c-body' && record.kind === 'shape'
        ? {
            ...record,
            fields: record.fields.map((field) =>
              field.name === 'name' ? { ...field, wireTag: 9 } : field,
            ),
          }
        : record,
    );
    const scalar = revised((record) =>
      record.id === 's2/shape/c-body' && record.kind === 'shape'
        ? {
            ...record,
            fields: record.fields.map((field) =>
              field.name === 'name' ? { ...field, type: 'bytes' } : field,
            ),
          }
        : record,
    );
    const envelope = revised((record) =>
      record.id === 's2/shape/c-wire' && record.kind === 'shape'
        ? { ...record, wireType: 'OtherCreated' }
        : record,
    );
    expect(match(tags)).toContain('schemas');
    expect(match(scalar)).toContain('schemas');
    expect(match(envelope)).toContain('schemas');
  });
  it('rejects incomplete or differently encoded wire schemas', () => {
    const partial = revised((record) =>
      record.id === 's2/shape/c-body' && record.kind === 'shape'
        ? { ...record, completeness: 'partial' }
        : record,
    );
    const encoding = revised((record) =>
      record.id === 's2/shape/p-wire' && record.kind === 'shape'
        ? { ...record, encoding: 'json' }
        : record,
    );
    expect(match(partial)).toContain('schemas');
    expect(match(encoding)).toContain('protobuf');
  });
  it('matches the actual header and message filter', () => {
    const header = revised((record) =>
      record.kind === 'subscription' ? { ...record, header: 'other-type' } : record,
    );
    const type = revised((record) =>
      record.kind === 'subscription' ? { ...record, messageType: 'OtherCreated' } : record,
    );
    expect(match(header)).toContain('header');
    expect(match(type)).toContain('filter');
  });
  it('does not accept an unresolved handoff as a value invocation frame', () => {
    const records = revised((record) =>
      record.kind === 'handoff' ? { ...record, status: 'unresolved' } : record,
    );
    const reader = readerFor(records);
    expect(() =>
      queryKnowledge(
        reader,
        softOfferRequest(reader.snapshot, {
          query: 'value',
          value: 's2/v/cached-name',
          context: ['s2/http.add', 's2/add.notify', 's2/notify.send', 's2/handoff'],
          representation: 'persisted',
        }),
      ),
    ).toThrow('handoff context');
  });
  it('cannot unwind an unhandled consumer exception into the producer invocation', () => {
    const records = revised((record) =>
      record.id === 's2/consumer.failed' && record.kind === 'operation'
        ? { ...record, action: 'throw', exit: 'error' }
        : record,
    );
    const reader = readerFor(records);
    const result = queryKnowledge(reader, softOfferRequest(reader.snapshot));
    const failures = new Set(
      result.nodes.filter((node) => node.record === 's2/consumer.failed').map((node) => node.id),
    );
    expect(result.edges.some((edge) => failures.has(edge.from))).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'unhandled_exception')).toBe(
      true,
    );
  });
});

describe('canonical asynchronous invariants', () => {
  it('rejects a read effect used as a write acknowledgement', () => {
    const records = revised((record) =>
      record.id === 's2/write/save' && record.kind === 'storage_write'
        ? { ...record, effect: 's2/effect/refetch' }
        : record,
    );
    expect(problems(records)).toContain('requires a write effect');
  });
  it('rejects acknowledgements, values or policies attached to another implementation', () => {
    const records = revised((record) =>
      record.id === 's2/write/hot' && record.kind === 'storage_write'
        ? { ...record, acknowledgedAt: 's2/add.saved' }
        : record,
    );
    expect(problems(records)).toContain('share owning implementation');
  });
  it('rejects bindings to a caller value masquerading as a consumer value', () => {
    const records = revised((record) =>
      record.kind === 'handoff'
        ? {
            ...record,
            bindings: [{ from: 's2/v/message', to: 's2/v/entity', transform: 'invalid' }],
          }
        : record,
    );
    expect(problems(records)).toContain('producer to subscriber');
  });
  it('requires a publication effect from the producer', () => {
    const records = revised((record) =>
      record.kind === 'handoff' ? { ...record, effect: 's2/effect/save' } : record,
    );
    expect(problems(records)).toContain("producer's publication effect");
  });
  it('requires the producer revision and resource to match the binding', () => {
    const records = revised((record) =>
      record.id === 's2/channel/producer' && record.kind === 'channel_binding'
        ? { ...record, source: 's2/c', resource: 's2/blob' }
        : record,
    );
    expect(problems(records)).toContain('producer source and resource');
  });
  it('requires the subscriber revision to match its binding', () => {
    const records = revised((record) =>
      record.id === 's2/channel/consumer' && record.kind === 'channel_binding'
        ? { ...record, source: 's2/p' }
        : record,
    );
    expect(problems(records)).toContain('subscriber source');
  });
  it('does not allow a value key without a producer-owned key value', () => {
    const missing = revised((record) =>
      record.kind === 'handoff' ? { ...record, partitionKey: 'value' } : record,
    );
    const foreign = revised((record) =>
      record.kind === 'handoff'
        ? { ...record, partitionKey: 'value', keyValue: 's2/v/entity-id' }
        : record,
    );
    expect(problems(missing)).toContain('key mode');
    expect(problems(foreign)).toContain('key and correlation');
  });
  it('rejects duplicate, reserved or missing protobuf field tags', () => {
    const records = revised((record) =>
      record.id === 's2/shape/p-body' && record.kind === 'shape'
        ? { ...record, fields: record.fields.map((field) => ({ ...field, wireTag: 5 })) }
        : record,
    );
    expect(problems(records)).toContain('present, unique and not reserved');
  });
  it('requires array item shapes and keeps them separate from object fields', () => {
    const arrayFields = revised((record) =>
      record.id === 's2/shape/upstream' && record.kind === 'shape'
        ? { ...record, fields: [{ name: 'Name', type: 'string', status: 'declared' }] }
        : record,
    );
    const objectItems = revised((record) =>
      record.id === 's2/shape/upstream' && record.kind === 'shape'
        ? { ...record, container: 'object' }
        : record,
    );
    const wrongItems = revised((record) =>
      record.id === 's2/shape/upstream' && record.kind === 'shape'
        ? { ...record, items: 's2/v/message' }
        : record,
    );
    expect(problems(arrayFields)).toContain('array shape requires items');
    expect(problems(objectItems)).toContain('only array shapes have items');
    expect(problems(wrongItems)).toContain('must reference shape');
  });
  it('rejects v2 data under v1 replay rules before opening a database', async () => {
    const manifest = snapshotFor([bundle]);
    await expect(
      importKnowledgeSnapshot('/does-not-exist/index.sqlite', { manifest, bundles: [bundle] }),
    ).rejects.toThrow('V2 bundles');
  });
  it('requires v2 bounds and keeps the archived v1 request vocabulary immutable', () => {
    const request = softOfferRequest('test-snapshot');
    const { maxRecords, ...unbounded } = request;
    expect(maxRecords).toBe(2000);
    expect(() => parse.request(unbounded)).toThrow('maxRecords');
    expect(() => parse.request({ ...request, format: 'groundwork-query/v1' })).toThrow(
      'QueryRequest',
    );
  });
});
