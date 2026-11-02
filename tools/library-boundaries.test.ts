import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('capture');
const parse = await knowledgeValidators();
// Synthetic contract classifications leave the immutable source fixture unchanged.
function readerFor(protocol: string, contract = 'u3/contract/session-lookup'): KnowledgeReader {
  const records = bundle.records.map((record): KnowledgeRecord =>
    record.kind === 'interface_contract' && record.id === contract
      ? { ...record, protocol }
      : record,
  );
  expect(checkKnowledge(parse.bundle({ ...bundle, records }))).toEqual([]);
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'synthetic-library-boundary',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

describe('library boundaries in component projections', () => {
  it('preserves unresolved SDK/library effects without claiming an established component', () => {
    const reader = readerFor('source-library');
    const result = parse.response(
      queryKnowledge(reader, runtimeRequest('capture', reader.snapshot)),
    );
    expect(result.nodes.find((node) => node.record === 'u3/interaction/session')?.label).toContain(
      'library effects unresolved',
    );
    expect(result.edges.find((edge) => edge.record === 'u3/interaction/session')?.on).toBe(
      'unknown',
    );
    expect(result.records.find((record) => record.id === 'u3/interaction/session')?.kind).toBe(
      'interaction',
    );
    expect(result.records.some((record) => record.id === 'u3/interaction/session')).toBe(true);
    expect(
      result.findings.some((finding) => finding.support.includes('u3/interaction/session')),
    ).toBe(true);
    expect(result.frontiers.some((frontier) => frontier.reason === 'version_unresolved')).toBe(
      true,
    );
    expect(result.edges.some((edge) => edge.record === 'u3/interaction/capture')).toBe(true);
  });

  it('keeps a genuinely unknown transport boundary visible', () => {
    const reader = readerFor('unresolved-transport');
    const result = queryKnowledge(reader, runtimeRequest('capture', reader.snapshot));
    expect(result.nodes.some((node) => node.record === 'u3/interaction/session')).toBe(true);
    expect(result.edges.some((edge) => edge.record === 'u3/interaction/session')).toBe(true);
  });

  it('does not hide a source-declared network call with an unresolved destination', () => {
    const reader = readerFor('source-library', 'u3/contract/capture-outbound');
    const result = queryKnowledge(reader, runtimeRequest('capture', reader.snapshot));
    expect(result.edges.find((edge) => edge.record === 'u3/interaction/capture')).toMatchObject({
      on: 'request_response',
    });
  });

  it('does not hide an established store target because of a contract label', () => {
    const reader = readerFor('source-library', 'u3/contract/transaction-read');
    const result = queryKnowledge(reader, runtimeRequest('capture', reader.snapshot));
    expect(result.edges.find((edge) => edge.record === 'u3/interaction/transaction')).toMatchObject(
      {
        to: 'u3/component/mongo',
        on: 'read',
      },
    );
  });
});
