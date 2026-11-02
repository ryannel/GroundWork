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
const sourceCall = bundle.records.find((record) => record.id === 's2/http.add');
if (sourceCall?.kind !== 'operation') throw new Error('Missing call fixture');
const call = sourceCall;
const captures = call.bindings.map((binding) => binding.parameter);

// Mutated test graphs exercise lexical bindings; they are not new claims about Volvo source.
function lexicalRecords(
  mode: 'value' | 'reference' | 'unresolved' = 'reference',
): KnowledgeRecord[] {
  return bundle.records.map((record): KnowledgeRecord => {
    if (record.id === 's2/add' && record.kind === 'implementation') {
      return { ...record, parameters: [], captures };
    }
    if (record.kind === 'value' && captures.includes(record.id)) {
      return { ...record, role: 'capture' };
    }
    if (record.id === call.id) {
      return {
        ...call,
        bindings: [],
        captureBindings: call.bindings.map((binding) => ({
          capture: binding.parameter,
          value: binding.value,
          mode,
        })),
      };
    }
    return record;
  });
}

function changedCall(change: Partial<Operation>): KnowledgeRecord[] {
  return lexicalRecords().map((record) =>
    record.id === call.id && record.kind === 'operation' ? { ...record, ...change } : record,
  );
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'lexical-captures',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

function valueResult(records: readonly KnowledgeRecord[], context: string[] = [call.id]) {
  const reader = readerFor(records);
  return queryKnowledge(
    reader,
    runtimeRequest('soft-offer', reader.snapshot, {
      query: 'value',
      entry: context.length === 0 ? 's2/add' : 's2/endpoint',
      context,
      value: 's2/v/entity-name',
    }),
  );
}

describe('lexical capture bindings', () => {
  it('keeps prior captures without new fields valid', () => {
    expect(checkKnowledge(bundle)).toEqual([]);
  });

  it.each(['value', 'reference', 'unresolved'] as const)(
    'validates zero-formal invocation with distinct %s lexical bindings',
    (mode) => {
      const records = lexicalRecords(mode);
      expect(checkKnowledge(parse.bundle({ ...bundle, records }))).toEqual([]);
      const target = records.find((record) => record.id === 's2/add');
      expect(target?.kind === 'implementation' && target.parameters).toEqual([]);
    },
  );

  it('traces a captured value to this invocation actual HTTP source field', () => {
    const result = valueResult(lexicalRecords());
    expect(result.nodes.some((node) => node.record === 's2/v/input-name')).toBe(true);
    expect(result.nodes.find((node) => node.record === 's2/v/input-name')?.context).toEqual([]);
    expect(result.edges.some((edge) => edge.record === call.id)).toBe(true);
    expect(result.edges.find((edge) => edge.record === call.id)?.condition).toContain('reference');
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      false,
    );
  });

  it('composes captured origins with return-to-result bindings', () => {
    const records = lexicalRecords().map((record): KnowledgeRecord => {
      if (record.id === call.id && record.kind === 'operation') {
        return { ...record, result: 'capture-test/result' };
      }
      if (record.id === 's2/add.return' && record.kind === 'operation') {
        return { ...record, result: 's2/v/entity-name' };
      }
      return record;
    });
    records.push({
      id: 'capture-test/result',
      kind: 'value',
      owner: 's2/http',
      definition: call.id,
      label: 'Synthetic closure result',
      role: 'definition',
      representation: 'constructed',
      shape: null,
      evidence: call.evidence,
      accessPath: [],
    });
    expect(checkKnowledge({ ...bundle, records })).toEqual([]);
    const reader = readerFor(records);
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, {
        query: 'value',
        value: 'capture-test/result',
      }),
    );
    expect(result.nodes.some((node) => node.record === 's2/v/input-name')).toBe(true);
    expect(result.edges.some((edge) => edge.record === 's2/add.return')).toBe(true);
  });

  it('retains uncertain capture semantics as an explicit frontier', () => {
    const result = valueResult(lexicalRecords('unresolved'));
    expect(result.nodes.some((node) => node.record === 's2/v/input-name')).toBe(true);
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
  });

  it('does not infer an invocation when a closure is queried alone', () => {
    const result = valueResult(lexicalRecords(), []);
    expect(result.nodes).toHaveLength(1);
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
  });

  it('includes capture declarations and bindings in supporting and invalidation references', () => {
    const records = lexicalRecords();
    const target = records.find((record) => record.id === 's2/add');
    const invoked = records.find((record) => record.id === call.id);
    if (target === undefined || invoked === undefined) throw new Error('Missing test records');
    expect(recordReferences(target)).toEqual(expect.arrayContaining(captures));
    expect(recordReferences(invoked)).toEqual(
      expect.arrayContaining(['s2/v/input-name', ...captures]),
    );
  });

  it.each([
    { captureBindings: [] },
    { captureBindings: [{ capture: 'wrong', value: 's2/v/input-name', mode: 'reference' }] },
    {
      captureBindings: captures.map((capture) => ({
        capture,
        value: 's2/v/entity',
        mode: 'reference',
      })),
    },
    { action: 'compute' },
    { resolution: null },
  ] satisfies Partial<Operation>[])(
    'rejects incomplete, foreign or unbound capture invocation %#',
    (change) => {
      expect(checkKnowledge({ ...bundle, records: changedCall(change) }).length).toBeGreaterThan(0);
    },
  );

  it('rejects duplicated target capture bindings', () => {
    const records = lexicalRecords().map((record): KnowledgeRecord => {
      if (record.id !== call.id || record.kind !== 'operation') return record;
      const bindings = record.captureBindings ?? [];
      return { ...record, captureBindings: [...bindings, ...bindings] };
    });
    expect(checkKnowledge({ ...bundle, records }).some((error) => error.includes('unique'))).toBe(
      true,
    );
  });

  it.each(['orphan', 'formal', 'wrong-definition', 'wrong-role', 'wrong-owner'])(
    'rejects malformed capture declarations: %s',
    (scenario) => {
      const records = lexicalRecords().map((record): KnowledgeRecord => {
        if (record.id === 's2/add' && record.kind === 'implementation') {
          if (scenario === 'orphan') return { ...record, captures: [] };
          if (scenario === 'formal') return { ...record, parameters: [...captures] };
        }
        if (record.id === 's2/v/entity-name' && record.kind === 'value') {
          if (scenario === 'wrong-definition') return { ...record, definition: 's2/add.return' };
          if (scenario === 'wrong-role') return { ...record, role: 'definition' };
          if (scenario === 'wrong-owner') return { ...record, owner: 's2/http' };
        }
        return record;
      });
      expect(checkKnowledge({ ...bundle, records }).length).toBeGreaterThan(0);
    },
  );

  it('requires an explicit capture mode in the v3 schema', () => {
    const records = changedCall({
      captureBindings: [{ capture: 's2/v/entity', value: 's2/v/input' } as never],
    });
    expect(() => parse.bundle({ ...bundle, records })).toThrow(/mode/u);
  });
});
