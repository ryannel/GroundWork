import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { handoffMatch } from '@/domain/knowledge/handoff-match';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord, Subscription } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
const original = bundle.records.find((record) => record.id === 's2/subscription');
if (original?.kind !== 'subscription') throw new Error('Missing subscription fixture');

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const map = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'subscription-test',
    rules: 'knowledge-query/v3',
    get: (id) => map.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}
function changed(subscription: Subscription): KnowledgeRecord[] {
  return bundle.records.map((record) => (record.id === subscription.id ? subscription : record));
}
function problems(records: readonly KnowledgeRecord[]): string {
  return checkKnowledge(parse.bundle({ ...bundle, records })).join('\n');
}
function match(records: readonly KnowledgeRecord[]): string | null {
  const reader = readerFor(records);
  const handoff = reader.get('s2/handoff');
  if (handoff?.kind !== 'handoff') throw new Error('Missing handoff fixture');
  return handoffMatch(reader.get, handoff, 'production-profile');
}

describe('source-declared subscription header filters', () => {
  it('can require header presence without inventing an equality filter', () => {
    const records = changed({ ...original, headerFilter: 'present', messageType: null });
    expect(problems(records)).toBe('');
    expect(match(records)).toBeNull();
    expect(
      problems(changed({ ...original, headerFilter: 'present', header: null, messageType: null })),
    ).toContain('presence filters require a header');
  });
  it('supports consumption without a header filter while retaining wire and channel checks', () => {
    const records = changed({ ...original, headerFilter: 'none', header: null, messageType: null });
    expect(problems(records)).toBe('');
    expect(match(records)).toBeNull();
    const wrongChannel = records.map((record) =>
      record.id === 's2/channel/consumer' && record.kind === 'channel_binding'
        ? { ...record, channel: 'other' }
        : record,
    );
    expect(match(wrongChannel)).toContain('channel differs');
    const wrongPayload = records.map((record) =>
      record.id === 's2/shape/c-body' && record.kind === 'shape'
        ? { ...record, completeness: 'partial' as const }
        : record,
    );
    expect(match(wrongPayload)).toContain('schemas');
  });
  it('distinguishes an unexamined filter from an explicitly absent filter', () => {
    const records = changed({
      ...original,
      headerFilter: 'unresolved',
      header: null,
      messageType: null,
      gaps: ['s2/gap/sdk-policy'],
    });
    expect(match(records)).toBe('Consumer header filter is unresolved');
    expect(problems(records)).toContain('Consumer header filter is unresolved');
  });
  it('requires a gap for unresolved filtering and values for an exact filter', () => {
    expect(
      problems(
        changed({
          ...original,
          headerFilter: 'unresolved',
          header: null,
          messageType: null,
          gaps: [],
        }),
      ),
    ).toContain('unresolved header filters require a gap');
    expect(problems(changed({ ...original, header: null, messageType: null }))).toContain(
      'exact header filters require',
    );
    expect(problems(changed({ ...original, headerFilter: 'none' }))).toContain(
      'cannot assert a header value',
    );
  });
  it('can start a subscription query without a known producer handoff when its host is explicit', () => {
    const records = changed({ ...original, headerFilter: 'none', header: null, messageType: null })
      .filter((record) => record.kind !== 'handoff')
      .map((record) => (record.kind === 'interaction' ? { ...record, handoff: null } : record));
    const reader = readerFor(records);
    const request = runtimeRequest('soft-offer', reader.snapshot, { entry: original.id });
    const result = queryKnowledge(reader, request);
    expect(result.nodes.some((node) => node.id === 'u3/component/assortment-worker')).toBe(true);
    expect(result.edges.some((edge) => edge.on === 'consume')).toBe(true);
  });
  it('rejects a subscriber whose owner source differs from its channel source even without a handoff', () => {
    const records = changed({ ...original, binding: 's2/channel/producer' })
      .filter((record) => record.kind !== 'handoff')
      .map((record) => (record.kind === 'interaction' ? { ...record, handoff: null } : record));
    expect(problems(records)).toContain('subscriber source must match channel binding');
  });
});
