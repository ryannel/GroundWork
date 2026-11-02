import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { syntheticServiceRecords } from './runtime-service-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
function revised(change: (record: KnowledgeRecord) => KnowledgeRecord): KnowledgeRecord[] {
  return bundle.records.map(change);
}
function problems(records: readonly KnowledgeRecord[]): string {
  return checkKnowledge({ ...bundle, records: [...records] }).join('\n');
}
function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'synthetic',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}
function remoteService(): KnowledgeRecord[] {
  return syntheticServiceRecords(bundle, parse.record);
}

describe('runtime binding invariants', () => {
  it('can bind a known outbound HTTP call to another service and its exposed endpoint', () => {
    const records = remoteService();
    expect(problems(records)).toBe('');
    const reader = readerFor(records);
    const result = queryKnowledge(reader, runtimeRequest('soft-offer', reader.snapshot));
    expect(result.edges.find((edge) => edge.record === 'test/interaction')).toMatchObject({
      from: 'u3/component/mas',
      to: 'test/component',
      on: 'request_response',
    });
  });
  it('does not leak a shared implementation from another host into this invocation', () => {
    const records: KnowledgeRecord[] = [
      ...remoteService(),
      {
        id: 'test/foreign-execution',
        kind: 'execution_binding',
        implementation: 's2/publish',
        component: 'test/component',
        basis: 'source_declared',
        artifactBinding: null,
        gaps: [],
        evidence: ['s2/e/producer'],
      },
    ];
    const foreign: KnowledgeRecord = {
      id: 'test/foreign-interaction',
      kind: 'interaction',
      owner: 's2/publish',
      execution: 'test/foreign-execution',
      operation: 's2/publish.attempt',
      target: 'test/component',
      targetEntry: 'test/entry',
      contract: 'test/contract',
      effect: null,
      handoff: null,
      mode: 'request_response',
      boundary: 'network',
      waitsFor: 'response',
      condition: 'Other host only',
      requestBindings: [],
      responseBindings: [],
      gaps: [],
      evidence: ['s2/e/producer'],
    };
    const reader = readerFor([...records, foreign]);
    const result = queryKnowledge(reader, runtimeRequest('soft-offer', reader.snapshot));
    expect(result.nodes.some((node) => node.id === 'test/component')).toBe(true);
    expect(result.edges.some((edge) => edge.record === foreign.id)).toBe(false);
    expect(result.findings.flatMap((finding) => finding.support)).not.toContain(
      'test/foreign-execution',
    );
  });
  it('rejects hosting code in a store or topic', () => {
    const records = revised((record) =>
      record.id === 'u3/runs/s2-publish' && record.kind === 'execution_binding'
        ? { ...record, component: 'u3/component/commercial-topic' }
        : record,
    );
    expect(problems(records)).toContain('only service or app components execute code');
  });
  it('requires exact artefact bindings before foreign source can execute in a host', () => {
    const foreign = revised((record) =>
      record.id === 'u3/runs/s2-publish' && record.kind === 'execution_binding'
        ? { ...record, component: 'u3/component/assortment-worker' }
        : record,
    );
    expect(problems(foreign)).toContain('exact artefact binding');
    const asserted = revised((record) =>
      record.id === 'u3/runs/s2-publish' && record.kind === 'execution_binding'
        ? { ...record, basis: 'artifact_verified' }
        : record,
    );
    expect(problems(asserted)).toContain('exact artefact source binding required');
  });
  it('rejects an interface exposure attached to a different implementation or route', () => {
    const owner = revised((record) =>
      record.kind === 'entry_binding' ? { ...record, execution: 'u3/runs/s2-publish' } : record,
    );
    const route = revised((record) =>
      record.id === 'u3/contract/soft-api' && record.kind === 'interface_contract'
        ? { ...record, path: '/wrong-route' }
        : record,
    );
    expect(problems(owner)).toContain('entry, host execution and contract must agree');
    expect(problems(route)).toContain('registered entry route');
  });
  it('rejects a call site or transferred value from another implementation', () => {
    const site = revised((record) =>
      record.id === 'u3/interaction/publish' && record.kind === 'interaction'
        ? { ...record, operation: 's2/consumer.receive' }
        : record,
    );
    const value = revised((record) =>
      record.id === 'u3/interaction/publish' && record.kind === 'interaction'
        ? {
            ...record,
            requestBindings: [
              {
                part: 'message',
                path: [],
                value: 's2/v/payload',
                transform: 'Incorrect ownership',
              },
            ],
          }
        : record,
    );
    expect(problems(site)).toContain('runtime execution must share implementation');
    expect(problems(value)).toContain('transferred values must belong');
  });
  it('rejects target, contract and resource bindings that disagree', () => {
    const target = revised((record) =>
      record.id === 'u3/interaction/publish' && record.kind === 'interaction'
        ? { ...record, target: 'u3/component/redis' }
        : record,
    );
    const resource = revised((record) =>
      record.id === 'u3/resource/s2-topic' && record.kind === 'resource_binding'
        ? { ...record, component: 'u3/component/redis' }
        : record,
    );
    expect(problems(target)).toContain('target component must agree');
    expect(problems(resource)).toContain('effect resource requires matching runtime binding');
  });
  it('cannot promote a candidate contract to an established runtime target', () => {
    const records = remoteService().map((record) =>
      record.id === 'test/contract' && record.kind === 'interface_contract'
        ? { ...record, authority: 'candidate' as const }
        : record,
    );
    expect(problems(records)).toContain('candidate contract cannot establish a runtime target');
  });
  it('requires an exposed target entry and a gap for an unresolved destination', () => {
    const entry = remoteService().filter((record) => record.id !== 'test/exposes');
    const unresolved = revised((record) =>
      record.id === 'u3/interaction/publish' && record.kind === 'interaction'
        ? { ...record, target: null, gaps: [] }
        : record,
    );
    expect(problems(entry)).toContain('matching contract exposure');
    expect(problems(unresolved)).toContain('unresolved target requires a gap');
  });
  it('requires explicit uncertainty when schema or presence is unknown', () => {
    const records = revised((record) =>
      record.id === 'u3/contract/soft-api' && record.kind === 'interface_contract'
        ? { ...record, request: record.request.map((part) => ({ ...part, shape: null, gaps: [] })) }
        : record,
    );
    expect(problems(records)).toContain('unknown schema requires a gap');
  });
  it('keeps absent payloads distinct from unknown schemas', () => {
    const records = revised((record) =>
      record.id === 'u3/contract/soft-created' && record.kind === 'interface_contract'
        ? {
            ...record,
            request: record.request.map((part) =>
              part.part === 'key' ? { ...part, shape: 's2/shape/p-wire' } : part,
            ),
          }
        : record,
    );
    expect(problems(records)).toContain('absent contract parts must not assert a shape');
  });
  it('returns a frontier when the runtime entry binding is missing', () => {
    const reader = readerFor(bundle.records.filter((record) => record.kind !== 'entry_binding'));
    const result = queryKnowledge(reader, runtimeRequest('soft-offer', reader.snapshot));
    expect(result.nodes).toEqual([]);
    expect(result.frontiers[0]?.detail).toContain('runtime execution binding');
  });
  it('keeps consumption ownership and payload schema tied to the actual handoff', () => {
    const wrongOwner = revised((record) =>
      record.id === 'u3/interaction/consume' && record.kind === 'interaction'
        ? {
            ...record,
            owner: 's2/publish',
            execution: 'u3/runs/s2-publish',
            operation: 's2/publish.attempt',
            requestBindings: [],
          }
        : record,
    );
    const wrongSchema = revised((record) =>
      record.id === 'u3/contract/soft-created' && record.kind === 'interface_contract'
        ? {
            ...record,
            request: record.request.map((part) =>
              part.part === 'message' ? { ...part, shape: 'u3/shape/message-headers' } : part,
            ),
          }
        : record,
    );
    expect(problems(wrongOwner)).toContain('consumption must execute its handoff subscription');
    expect(problems(wrongSchema)).toContain(
      'handoff requires its producer or consumer message schema',
    );
  });
  it('requires source anchors and unambiguous execution bindings in v3', () => {
    const missing = revised((record) => {
      if (record.kind !== 'evidence') return record;
      const legacy = { ...record };
      delete legacy.host;
      return legacy;
    });
    expect(problems(missing)).toContain('v3 evidence requires a GitHub host');
    const original = bundle.records.find((record) => record.id === 'u3/runs/s2-http');
    if (original === undefined) throw new Error('Missing execution binding');
    expect(problems([...bundle.records, { ...original, id: 'test/duplicate' }])).toContain(
      'duplicate implementation binding',
    );
  });
  it('reports missing host bindings instead of silently claiming complete runtime reachability', () => {
    const records = remoteService().map((record) =>
      record.id === 'u3/runs/s2-publish' && record.kind === 'execution_binding'
        ? { ...record, component: 'test/component' }
        : record,
    );
    const reader = readerFor(records);
    const result = queryKnowledge(reader, runtimeRequest('soft-offer', reader.snapshot));
    expect(result.frontiers.some((frontier) => frontier.detail.includes('invocation host'))).toBe(
      true,
    );
    const trace = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, { query: 'trace' }),
    );
    expect(trace.nodes.find((node) => node.record === 's2/publish.attempt')).toMatchObject({
      component: null,
      execution: null,
    });
  });
  it('derives escaped GitHub permalinks with an exact commit and line range', () => {
    const evidence = bundle.records.find((record) => record.kind === 'evidence');
    if (evidence?.kind !== 'evidence') throw new Error('Missing source fixture');
    const url = evidenceAnchor({
      ...evidence,
      repo: 'organisation/repository',
      path: 'src/a file#name.cs',
      lines: [12, 19],
    });
    expect(url).toBe(
      `https://github.com/organisation/repository/blob/${evidence.commit}/src/a%20file%23name.cs#L12-L19`,
    );
    const { host, ...legacy } = evidence;
    expect(host).toBe('github.com');
    expect(evidenceAnchor(legacy)).toBeNull();
  });
});
