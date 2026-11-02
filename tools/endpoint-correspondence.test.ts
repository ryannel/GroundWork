import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type {
  InterfaceContract,
  KnowledgeRecord,
  QueryRequest,
} from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { syntheticServiceRecords } from './runtime-service-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
const CALLER = 'test/caller-contract';

function correspondence(): KnowledgeRecord[] {
  const records = syntheticServiceRecords(bundle, parse.record);
  const provider = records.find((r) => r.id === 'test/contract');
  if (provider?.kind !== 'interface_contract') throw new Error('Missing provider');
  const caller: InterfaceContract = {
    ...provider,
    id: CALLER,
    authority: 'caller_construction',
    name: 'Synthetic caller construction',
    request: [
      {
        part: 'body',
        presence: 'present',
        shape: 'u3/shape/message-headers',
        sourceShape: null,
        contentType: 'application/json',
        gaps: [],
        evidence: provider.evidence,
      },
    ],
  };
  return [
    ...records.map((r): KnowledgeRecord => {
      if (r.id === 'test/interaction' && r.kind === 'interaction') {
        return { ...r, contract: CALLER };
      }
      if (r.id !== provider.id) return r;
      return {
        ...provider,
        request: caller.request.map((part) => ({ ...part, presence: 'none', shape: null })),
      };
    }),
    caller,
  ];
}

function problems(records: readonly KnowledgeRecord[]): string[] {
  return checkKnowledge(parse.bundle({ ...bundle, records }));
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((r) => [r.id, r]));
  return {
    snapshot: 'synthetic-correspondence',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((r) => recordIndexes(r).get(field)?.includes(value) ?? false),
  };
}

describe('caller and provider source correspondence', () => {
  it('retains distinct schemas and exposes both without asserting payload compatibility', () => {
    const records = correspondence();
    expect(problems(records)).toEqual([]);
    const reader = readerFor(records);
    const request = parse.request(runtimeRequest('soft-offer', reader.snapshot));
    const result = parse.response(queryKnowledge(reader, request));
    expect(result.edges.some((e) => e.record === 'test/interaction')).toBe(true);
    expect(result.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: CALLER, authority: 'caller_construction' }),
        expect.objectContaining({ id: 'test/contract', authority: 'source_declared' }),
        expect.objectContaining({ id: 'test/exposes', entry: 'test/entry' }),
      ]),
    );
    expect(
      result.findings.some((f) => f.assumptions.some((a) => a.includes('payload compatibility'))),
    ).toBe(true);
  });
  it('retains both sides across small supporting-record pages', () => {
    const reader = readerFor(correspondence());
    let request: QueryRequest | null = parse.request({
      ...runtimeRequest('soft-offer', reader.snapshot),
      maxRecords: 4,
    });
    const collected = new Set<string>();
    let pages = 0;
    do {
      const response = parse.response(queryKnowledge(reader, request));
      for (const record of response.records) {
        expect(collected.has(record.id)).toBe(false);
        collected.add(record.id);
      }
      pages += 1;
      expect(pages).toBeLessThan(200);
      request = response.nextRequest ?? null;
    } while (request !== null);
    expect(pages).toBeGreaterThan(1);
    expect([...collected]).toEqual(
      expect.arrayContaining([CALLER, 'test/contract', 'test/exposes']),
    );
  });
  it.each(['http', 'https'])('accepts exact source addresses for %s', (protocol) => {
    const records = correspondence().map((r) =>
      r.id === CALLER || r.id === 'test/contract' ? parse.record({ ...r, protocol }) : r,
    );
    expect(problems(records)).toEqual([]);
  });
  it('retains unary gRPC registration rules on both sides', () => {
    const address = { method: 'RPC', path: '/test.Downstream/Invoke' };
    const records = correspondence().map((r) => {
      if (r.id === CALLER || r.id === 'test/contract') {
        return parse.record({ ...r, ...address, protocol: 'grpc' });
      }
      return r.id === 'test/entry' ? parse.record({ ...r, ...address, trigger: 'rpc' }) : r;
    });
    expect(problems(records)).toEqual([]);
  });
  it('does not use generic SDK names as endpoint correspondence', () => {
    const records = correspondence().map((r) =>
      r.id === CALLER || r.id === 'test/contract'
        ? parse.record({ ...r, protocol: 'source-library' })
        : r,
    );
    expect(problems(records).join('\n')).toContain('matching contract exposure');
  });
  it.each([
    ['protocol', 'https'],
    ['protocol', 'grpc'],
    ['method', 'GET'],
    ['method', null],
    ['path', '/rewritten'],
    ['path', null],
    ['authority', 'candidate'],
    ['authority', 'unresolved'],
    ['authority', 'source_declared'],
    ['component', 'u3/component/mas'],
  ])('rejects unsupported caller correspondence %s=%s', (field, value) => {
    const records = correspondence().map((r) =>
      r.id === CALLER ? parse.record({ ...r, [field]: value }) : r,
    );
    expect(problems(records).join('\n')).toContain('matching contract exposure');
  });
  it('requires an actual source-declared provider exposure', () => {
    const records = correspondence().map((r) =>
      r.id === 'test/contract' ? parse.record({ ...r, authority: 'candidate' }) : r,
    );
    expect(problems(records).join('\n')).toContain('matching contract exposure');
    expect(problems(correspondence().filter((r) => r.id !== 'test/exposes')).join('\n')).toContain(
      'matching contract exposure',
    );
  });
});
