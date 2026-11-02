import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeBundle } from '@/domain/knowledge/knowledge.generated';
import { snapshotFor } from '@/infrastructure/knowledge/knowledge-format';

import { captureProofInput, captureRequest } from './capture-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await captureProofInput();

function readerFor(input: KnowledgeBundle): KnowledgeReader {
  expect(checkKnowledge(input)).toEqual([]);
  return {
    snapshot: snapshotFor([input]).id,
    rules: 'knowledge-query/v1',
    get: (id) => input.records.find((record) => record.id === id),
    select: (index, value) =>
      input.records.filter((record) => recordIndexes(record).get(index)?.includes(value) === true),
  };
}

function addNewerClient(input: KnowledgeBundle): void {
  const original = input.records.find((record) => record.id === 'r1/candidate.client');
  const entry = input.records.find((record) => record.id === 'r1/candidate.client.entry');
  if (original?.kind !== 'implementation' || entry?.kind !== 'operation') {
    throw new Error('Missing candidate');
  }
  input.records.push(
    { ...original, id: 'newer/client', entry: 'newer/client.entry' },
    {
      ...entry,
      id: 'newer/client.entry',
      owner: 'newer/client',
      label: 'Newer candidate should not be selected implicitly',
    },
  );
}

describe('revision and traversal guarantees', () => {
  it('adding a newer candidate never resolves the caller automatically', () => {
    const changed = structuredClone(bundle);
    addNewerClient(changed);
    const reader = readerFor(changed);
    const result = queryKnowledge(reader, captureRequest(reader.snapshot));
    expect(result.nodes.some((node) => node.record === 'newer/client.entry')).toBe(false);
    expect(result.nodes.some((node) => node.record === 'r1/candidate.client.entry')).toBe(false);
  });

  it('selects an explicit artifact binding in a synthetic resolved-version fixture', () => {
    const changed = structuredClone(bundle);
    addNewerClient(changed);
    const artifact = changed.records.find((record) => record.id === 'r1/artifact/client');
    const binding = changed.records.find((record) => record.id === 'r1/binding/client');
    const resolution = changed.records.find((record) => record.id === 'r1/resolve.client');
    if (
      artifact?.kind !== 'artifact' ||
      binding?.kind !== 'artifact_source_binding' ||
      resolution?.kind !== 'resolution'
    ) {
      throw new Error('Missing fixture binding');
    }
    artifact.digest = 'a'.repeat(64);
    artifact.correspondence = 'verified';
    binding.artifact = artifact.id;
    binding.status = 'exact';
    resolution.target = 'r1/candidate.client';
    resolution.basis = 'artifact_verified';
    resolution.binding = binding.id;
    const target = changed.records.find((record) => record.id === 'r1/candidate.client');
    const call = changed.records.find((record) => record.id === 'r1/capture.remote');
    if (target?.kind !== 'implementation' || call?.kind !== 'operation') {
      throw new Error('Missing synthetic call');
    }
    target.parameters = call.bindings.map((item) => `synthetic/parameter/${item.parameter}`);
    changed.records.push(
      ...target.parameters.map((id) => ({
        id,
        kind: 'value' as const,
        owner: target.id,
        definition: target.entry,
        label: id,
        role: 'parameter' as const,
        accessPath: [],
        representation: 'source' as const,
        shape: null,
        evidence: ['r1/evidence/candidate-client'],
      })),
    );
    call.bindings = call.bindings.map((item) => ({
      ...item,
      parameter: `synthetic/parameter/${item.parameter}`,
    }));
    const reader = readerFor(changed);
    const result = queryKnowledge(reader, captureRequest(reader.snapshot));
    expect(result.nodes.some((node) => node.record === 'r1/candidate.client.entry')).toBe(true);
    expect(result.nodes.some((node) => node.record === 'newer/client.entry')).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'opaque')).toBe(true);
  });

  it('traces returned values in the callee invocation context', () => {
    const reader = readerFor(bundle);
    const result = queryKnowledge(
      reader,
      captureRequest(reader.snapshot, {
        query: 'value',
        value: 'r1/value/validator.completed',
        context: ['r1/controller.invoke', 'r1/capture.validate'],
        representation: 'source',
      }),
    );
    expect(result.nodes.map((node) => node.record)).toContain('r1/value/predicate.trueValue');
    expect(result.nodes.map((node) => node.record)).toContain('r1/value/predicate.falseValue');
    expect(
      result.nodes.find((node) => node.record === 'r1/value/predicate.trueValue')?.context,
    ).toEqual(['r1/controller.invoke', 'r1/capture.validate', 'r1/validator.predicate']);
  });

  it('stops recursive calls at an explicit cycle frontier', () => {
    const changed = structuredClone(bundle);
    const resolution = changed.records.find((record) => record.id === 'r1/resolve.predicate');
    const call = changed.records.find((record) => record.id === 'r1/validator.predicate');
    if (resolution?.kind !== 'resolution' || call?.kind !== 'operation') {
      throw new Error('Missing recursive fixture');
    }
    resolution.target = 'r1/validator';
    call.bindings = [
      { parameter: 'r1/value/validator.transaction', value: 'r1/value/validator.transaction' },
    ];
    const reader = readerFor(changed);
    const result = queryKnowledge(reader, captureRequest(reader.snapshot));
    expect(result.frontiers.some((frontier) => frontier.reason === 'cycle')).toBe(true);
    expect(result.nodes.length).toBeLessThan(20);
    expect(result.exhaustive).toBe(false);
  });

  it('marks unsupported operations and preserves their local continuation', () => {
    const changed = structuredClone(bundle);
    const mapper = changed.records.find((record) => record.id === 'r1/capture.map');
    if (mapper?.kind !== 'operation') throw new Error('Missing mapper');
    mapper.action = 'opaque';
    const reader = readerFor(changed);
    const result = queryKnowledge(reader, captureRequest(reader.snapshot));
    expect(result.frontiers.some((frontier) => frontier.reason === 'opaque')).toBe(true);
    expect(result.nodes.map((node) => node.record)).toContain('r1/capture.transaction');
  });

  it('invalidates the endpoint from mapper and configuration evidence through extraction dependencies', () => {
    const reader = readerFor(bundle);
    for (const input of ['r1/evidence/session-mapper', 'r1/evidence/configuration']) {
      const result = queryKnowledge(
        reader,
        captureRequest(reader.snapshot, { query: 'impact', changed: [input] }),
      );
      expect(result.nodes.map((node) => node.record)).toContain('r1/endpoint');
    }
  });

  it('bounds both value and impact queries and rejects invalid budgets and changed IDs', () => {
    const reader = readerFor(bundle);
    for (const options of [
      {
        query: 'value' as const,
        value: 'r1/value/outgoing.attributes',
        context: ['r1/controller.invoke'],
      },
      { query: 'impact' as const, changed: ['r1/evidence/completed'] },
    ]) {
      const result = queryKnowledge(
        reader,
        captureRequest(reader.snapshot, { ...options, maxNodes: 1 }),
      );
      expect(result.limitsHit).toEqual(['maxNodes']);
      expect(result.traversalComplete).toBe(false);
    }
    expect(() => queryKnowledge(reader, captureRequest(reader.snapshot, { maxNodes: 0 }))).toThrow(
      'budget',
    );
    expect(() =>
      queryKnowledge(reader, captureRequest(reader.snapshot, { query: 'outcome' })),
    ).toThrow('requires a status');
    expect(() =>
      queryKnowledge(
        reader,
        captureRequest(reader.snapshot, { query: 'impact', changed: ['missing'] }),
      ),
    ).toThrow('Unknown changed');
  });
});
