import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import { recordReferences } from '@/domain/knowledge/knowledge-references';
import type { KnowledgeRecord, Operation } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
const receiverId = 'receiver-test/this';
const callId = 's2/http.add';

// Synthetic fixture mutations test instance identity; original source claims remain immutable.
function receiverRecords(): KnowledgeRecord[] {
  const records = bundle.records.map((record): KnowledgeRecord => {
    if (record.id === 's2/add' && record.kind === 'implementation') {
      return { ...record, receiver: receiverId };
    }
    if (record.id === callId && record.kind === 'operation') {
      return { ...record, receiver: 's2/v/input' };
    }
    return record;
  });
  records.push({
    id: receiverId,
    kind: 'value',
    owner: 's2/add',
    definition: 's2/add.identity',
    role: 'receiver',
    label: 'Synthetic instance receiver',
    representation: 'constructed',
    shape: null,
    evidence: ['s2/e/add'],
    accessPath: [],
  });
  return records;
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'receiver-bindings',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

function problems(records: KnowledgeRecord[]): string[] {
  return checkKnowledge(parse.bundle({ ...bundle, records }));
}

function changeCall(change: Partial<Operation>): KnowledgeRecord[] {
  return receiverRecords().map((record) =>
    record.id === callId && record.kind === 'operation' ? { ...record, ...change } : record,
  );
}

function malformedReceiver(record: KnowledgeRecord, scenario: string): KnowledgeRecord {
  if (record.id === 's2/add' && record.kind === 'implementation') {
    switch (scenario) {
      case 'orphan': {
        return { ...record, receiver: null };
      }
      case 'formal': {
        return { ...record, parameters: [...record.parameters, receiverId] };
      }
      case 'capture': {
        return { ...record, captures: [receiverId] };
      }
      default: {
        return record;
      }
    }
  }
  if (record.id === receiverId && record.kind === 'value') {
    switch (scenario) {
      case 'definition': {
        return { ...record, definition: 's2/add.return' };
      }
      case 'role': {
        return { ...record, role: 'definition' };
      }
      case 'owner': {
        return { ...record, owner: 's2/http' };
      }
      default: {
        return record;
      }
    }
  }
  return record;
}

describe('instance receiver bindings', () => {
  it('binds an instance separately from all source formal arguments', () => {
    const records = receiverRecords();
    expect(problems(records)).toEqual([]);
    const target = records.find((record) => record.id === 's2/add');
    expect(target?.kind === 'implementation' && target.parameters).toHaveLength(6);
  });

  it('traces the selected invocation receiver back to its caller object', () => {
    const reader = readerFor(receiverRecords());
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, {
        query: 'value',
        context: [callId],
        value: receiverId,
      }),
    );
    expect(result.nodes.some((node) => node.record === 's2/v/input')).toBe(true);
    expect(result.edges.find((edge) => edge.record === callId)?.condition).toContain('receiver');
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      false,
    );
  });

  it('does not invent an instance when an implementation is queried alone', () => {
    const reader = readerFor(receiverRecords());
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, {
        query: 'value',
        entry: 's2/add',
        value: receiverId,
      }),
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
  });

  it('retains receiver origins in supporting-record and invalidation references', () => {
    const records = receiverRecords();
    const target = records.find((record) => record.id === 's2/add');
    const call = records.find((record) => record.id === callId);
    if (target === undefined || call === undefined) throw new Error('Missing fixture record');
    expect(recordReferences(target)).toContain(receiverId);
    expect(recordReferences(call)).toContain('s2/v/input');
  });

  it.each([
    { receiver: null },
    { receiver: 's2/v/entity' },
    { receiver: 's2/e/add' },
    { action: 'compute' },
  ] satisfies Partial<Operation>[])(
    'rejects absent, foreign or non-call receivers %#',
    (change) => {
      expect(problems(changeCall(change)).length).toBeGreaterThan(0);
    },
  );

  it('rejects an actual receiver when the bound target declares none', () => {
    const records = receiverRecords()
      .filter((record) => record.id !== receiverId)
      .map((record) =>
        record.kind === 'implementation' && record.id === 's2/add'
          ? { ...record, receiver: null }
          : record,
      );
    expect(problems(records).some((error) => error.includes('target declaration'))).toBe(true);
  });

  it('can preserve a receiver at an unresolved library call without binding a callee', () => {
    const records = changeCall({ bindings: [] }).map((record): KnowledgeRecord =>
      record.id === 's2/resolve/http.add' && record.kind === 'resolution'
        ? { ...record, basis: 'unresolved', target: null }
        : record,
    );
    expect(problems(records)).toEqual([]);
  });

  it.each(['orphan', 'formal', 'capture', 'definition', 'role', 'owner'])(
    'rejects invalid receiver declarations: %s',
    (scenario) => {
      const records = receiverRecords().map((record) => malformedReceiver(record, scenario));
      expect(problems(records).length).toBeGreaterThan(0);
    },
  );
});
