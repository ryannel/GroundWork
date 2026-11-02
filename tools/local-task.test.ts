import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord, QueryRequest } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
const callId = 's2/http.add';

// Mutated regression graphs; no changed claims about the original Volvo source.
function taskRecords(waitsFor: 'return' | 'await' | 'none'): KnowledgeRecord[] {
  return bundle.records
    .filter((record) => record.id !== 's2/t/3' && record.id !== 's2/derived/t/3')
    .map((record): KnowledgeRecord => {
      if (record.id === callId && record.kind === 'operation') return { ...record, waitsFor };
      if (record.id === 's2/add.return' && record.kind === 'operation') {
        return { ...record, action: 'throw', exit: 'error', result: null };
      }
      return record;
    });
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'local-task',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

function resultFor(records: readonly KnowledgeRecord[], options: Partial<QueryRequest> = {}) {
  const reader = readerFor(records);
  return queryKnowledge(
    reader,
    runtimeRequest('soft-offer', reader.snapshot, {
      query: 'trace',
      maxNodes: 1000,
      ...options,
    }),
  );
}

describe('local asynchronous call waiting', () => {
  it.each(['return', 'await', 'none'] as const)('validates a %s call boundary', (mode) => {
    expect(checkKnowledge(parse.bundle({ ...bundle, records: taskRecords(mode) }))).toEqual([]);
  });

  it('forks possible local work and immediate caller continuation without awaiting completion', () => {
    const result = resultFor(taskRecords('none'));
    expect(result.edges.some((edge) => edge.on === 'starts_async')).toBe(true);
    expect(result.edges.some((edge) => edge.on === 'not_awaited')).toBe(true);
    expect(result.nodes.some((node) => node.record === 's2/add.identity')).toBe(true);
    expect(result.nodes.some((node) => node.record === 's2/http.201')).toBe(true);
    expect(result.frontiers.some((frontier) => frontier.reason === 'concurrency_unresolved')).toBe(
      true,
    );
  });

  it('does not unwind child faults into the HTTP caller catch paths', () => {
    const result = resultFor(taskRecords('none'));
    expect(result.nodes.some((node) => node.record === 's2/http.500')).toBe(false);
    expect(result.nodes.some((node) => node.record === 's2/http.409')).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'unhandled_exception')).toBe(
      true,
    );
    expect(
      result.edges.some(
        (edge) => edge.from.endsWith('::s2/add.return') && edge.to.startsWith('root::'),
      ),
    ).toBe(false);
  });

  it.each(['return', 'await'] as const)('retains caller exception propagation for %s', (mode) => {
    const result = resultFor(taskRecords(mode));
    expect(result.nodes.some((node) => node.record === 's2/http.500')).toBe(true);
    expect(result.edges.some((edge) => edge.on === 'starts_async')).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'concurrency_unresolved')).toBe(
      false,
    );
  });

  it('does not claim non-awaited child failure is this HTTP response outcome', () => {
    const result = resultFor(taskRecords('none'), { query: 'outcome', outcome: 500 });
    expect(result.nodes).toEqual([]);
  });

  it('does not equate an unawaited task handle with eventual callee return data', () => {
    const records = taskRecords('none').map((record): KnowledgeRecord => {
      if (record.id === callId && record.kind === 'operation') {
        return { ...record, result: 'task-test/handle' };
      }
      if (record.id === 's2/add.return' && record.kind === 'operation') {
        return { ...record, action: 'return', exit: 'normal', result: 's2/v/entity' };
      }
      return record;
    });
    records.push({
      id: 'task-test/handle',
      kind: 'value',
      owner: 's2/http',
      definition: callId,
      label: 'Synthetic Task handle',
      role: 'definition',
      representation: 'constructed',
      shape: null,
      evidence: ['s2/e/add'],
      accessPath: [],
    });
    expect(checkKnowledge({ ...bundle, records })).toEqual([]);
    const result = resultFor(records, { query: 'value', value: 'task-test/handle' });
    expect(result.nodes).toHaveLength(1);
    expect(result.frontiers.some((frontier) => frontier.detail.includes('task or handle'))).toBe(
      true,
    );
  });

  it('continues the caller even when recursive detached work cannot be expanded', () => {
    const records = taskRecords('none').map((record): KnowledgeRecord => {
      if (record.id === 's2/resolve/http.add' && record.kind === 'resolution') {
        return { ...record, target: 's2/http' };
      }
      if (record.id === callId && record.kind === 'operation') {
        return { ...record, bindings: [{ parameter: 's2/v/request', value: 's2/v/request' }] };
      }
      return record;
    });
    expect(checkKnowledge({ ...bundle, records })).toEqual([]);
    const result = resultFor(records);
    expect(result.frontiers.some((frontier) => frontier.reason === 'cycle')).toBe(true);
    expect(result.nodes.some((node) => node.record === 's2/http.201')).toBe(true);
  });

  it('keeps possible child effects and asynchronous continuations discoverable', () => {
    const result = resultFor(taskRecords('none'), { query: 'interactions' });
    expect(result.edges.some((edge) => edge.on === 'publish')).toBe(true);
    expect(result.frontiers.some((frontier) => frontier.reason === 'concurrency_unresolved')).toBe(
      true,
    );
  });

  it('rejects a waiting boundary on a compute operation', () => {
    const records = taskRecords('none').map((record): KnowledgeRecord =>
      record.id === 's2/http.map' && record.kind === 'operation'
        ? { ...record, waitsFor: 'none' }
        : record,
    );
    expect(
      checkKnowledge({ ...bundle, records }).some((error) => error.includes('waiting boundary')),
    ).toBe(true);
  });
});
