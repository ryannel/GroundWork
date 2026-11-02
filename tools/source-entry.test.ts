import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { Entry, KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
const exposure = bundle.records.find(
  (record) => record.kind === 'entry_binding' && record.entry === 's2/endpoint',
);
if (exposure?.kind !== 'entry_binding') throw new Error('Missing fixture exposure');
const contractId = exposure.contract;
const modes = [
  { trigger: 'process', protocol: 'process', method: 'PROCESS' },
  { trigger: 'schedule', protocol: 'timer', method: 'SCHEDULE' },
  { trigger: 'startup', protocol: 'lifecycle', method: 'STARTUP' },
  { trigger: 'callback', protocol: 'callback', method: 'CALLBACK' },
  { trigger: 'rpc', protocol: 'grpc', method: 'RPC' },
] as const;

// Synthetic entry mutations exercise contract kinds; original source facts remain immutable.
function sourceRecords(mode: (typeof modes)[number]): KnowledgeRecord[] {
  const address = mode.trigger === 'rpc' ? '/example.Account/Get' : 'source:registered-address';
  return bundle.records.map((record): KnowledgeRecord => {
    if (record.kind === 'entry' && record.id === 's2/endpoint') {
      return {
        ...record,
        trigger: mode.trigger,
        method: mode.method,
        path: address,
      };
    }
    if (record.kind === 'interface_contract' && record.id === contractId) {
      return {
        ...record,
        protocol: mode.protocol,
        method: mode.method,
        path: address,
      };
    }
    return record;
  });
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'source-entries',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

function entryChanged(records: KnowledgeRecord[], change: Partial<Entry>): KnowledgeRecord[] {
  return records.map((record): KnowledgeRecord =>
    record.kind === 'entry' && record.id === 's2/endpoint' ? { ...record, ...change } : record,
  );
}

describe('source entry contracts', () => {
  it('rejects a gRPC entry without a full service and method address', () => {
    const mode = modes.find((item) => item.trigger === 'rpc');
    if (mode === undefined) throw new Error('Missing RPC mode');
    const records = entryChanged(sourceRecords(mode), { path: 'source:missing-service' });
    expect(checkKnowledge({ ...bundle, records })).toContain(
      `${exposure.id}: gRPC entry requires a full /service/method address`,
    );
  });
  it('retains default REST entry validation', () => {
    expect(checkKnowledge(bundle)).toEqual([]);
  });

  it.each(modes)('binds a source $trigger entry without inventing HTTP', (mode) => {
    const records = sourceRecords(mode);
    expect(checkKnowledge(parse.bundle({ ...bundle, records }))).toEqual([]);
    const reader = readerFor(records);
    const result = queryKnowledge(reader, runtimeRequest('soft-offer', reader.snapshot));
    expect(result.nodes.some((node) => node.component === 'u3/component/mas')).toBe(true);
    expect(result.frontiers.some((frontier) => frontier.detail.includes('Entry needs'))).toBe(
      false,
    );
  });

  it.each(modes)('rejects an HTTP protocol disguised as $trigger', (mode) => {
    const records = sourceRecords(mode).map((record): KnowledgeRecord =>
      record.id === contractId && record.kind === 'interface_contract'
        ? { ...record, protocol: 'http' }
        : record,
    );
    expect(
      checkKnowledge({ ...bundle, records }).some((error) =>
        error.includes(`${mode.trigger} entry requires`),
      ),
    ).toBe(true);
  });

  it.each(modes)('rejects a wrong sentinel method for $trigger', (mode) => {
    const records = entryChanged(sourceRecords(mode), { method: 'POST' });
    expect(
      checkKnowledge({ ...bundle, records }).some((error) =>
        error.includes(`${mode.trigger} entry requires`),
      ),
    ).toBe(true);
  });

  it('does not relax HTTP requirements for an omitted REST trigger', () => {
    const records = bundle.records.map((record): KnowledgeRecord =>
      record.id === contractId && record.kind === 'interface_contract'
        ? { ...record, protocol: 'process' }
        : record,
    );
    expect(
      checkKnowledge({ ...bundle, records }).some((error) =>
        error.includes('REST entry requires an HTTP contract'),
      ),
    ).toBe(true);
  });

  it('checks matching source registration addresses', () => {
    const records = entryChanged(sourceRecords(modes[0]), { path: 'source:other' });
    expect(
      checkKnowledge({ ...bundle, records }).some((error) =>
        error.includes('source entry address'),
      ),
    ).toBe(true);
  });

  it('still requires established source authority', () => {
    const records = sourceRecords(modes[0]).map((record): KnowledgeRecord =>
      record.id === contractId && record.kind === 'interface_contract'
        ? { ...record, authority: 'unresolved' }
        : record,
    );
    expect(
      checkKnowledge({ ...bundle, records }).some((error) =>
        error.includes('established contract'),
      ),
    ).toBe(true);
  });
});
