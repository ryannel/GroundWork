import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { Interaction, KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();

function localRecords(mode: 'publish' | 'consume'): KnowledgeRecord[] {
  const interaction = bundle.records.find(
    (record): record is Interaction => record.kind === 'interaction' && record.mode === mode,
  );
  const execution = bundle.records.find((record) => record.id === interaction?.execution);
  const contract = bundle.records.find((record) => record.id === interaction?.contract);
  const gap = bundle.records.find((record) => record.kind === 'gap');
  if (interaction === undefined || execution?.kind !== 'execution_binding') throw new Error(mode);
  if (contract?.kind !== 'interface_contract' || gap === undefined) throw new Error(mode);
  return [
    ...bundle.records.map((record): KnowledgeRecord =>
      record.id === interaction.id
        ? {
            ...interaction,
            boundary: 'in_process',
            target: execution.component,
            targetEntry: null,
            contract: 'test/local-contract',
            effect: null,
            handoff: null,
            gaps: [gap.id],
          }
        : record,
    ),
    { ...contract, id: 'test/local-contract', component: execution.component },
  ];
}

function problems(records: readonly KnowledgeRecord[]): string {
  return checkKnowledge(parse.bundle({ ...bundle, records: [...records] })).join('\n');
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'synthetic-in-process-boundary',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

function localResourceRecords(role: 'storage' | 'transport', local = true): KnowledgeRecord[] {
  const records = localRecords('publish');
  const publication = records.find(
    (record): record is Interaction =>
      record.kind === 'interaction' && record.boundary === 'in_process',
  );
  const binding = bundle.records.find(
    (record) => record.kind === 'resource_binding' && record.role === role,
  );
  if (publication === undefined) throw new Error(role);
  if (publication.target === null || binding?.kind !== 'resource_binding') throw new Error(role);
  const resource = { ...binding, id: 'test/local-resource', component: publication.target };
  return [...records, local ? { ...resource, scope: 'in_process' } : resource];
}

function publicationEffect(records: readonly KnowledgeRecord[]): KnowledgeRecord[] {
  const source = bundle.records.find(
    (record) => record.kind === 'interaction' && record.mode === 'publish',
  );
  if (source?.kind !== 'interaction' || source.effect === null) throw new Error('Missing effect');
  const effect = source.effect;
  return records.map((record): KnowledgeRecord =>
    record.kind === 'interaction' && record.boundary === 'in_process'
      ? { ...record, effect }
      : record,
  );
}

describe('source-proven in-process message boundaries', () => {
  it.each(['publish', 'consume'] as const)('keeps %s inside its execution component', (mode) => {
    const records = localRecords(mode);
    expect(problems(records)).toBe('');
    const local = records.find(
      (record): record is Interaction =>
        record.kind === 'interaction' && record.boundary === 'in_process',
    );
    if (local === undefined) throw new Error('Missing local interaction');
    const reader = readerFor(records);
    const request = parse.request({
      ...runtimeRequest('soft-offer', reader.snapshot),
      entry: local.owner,
    });
    const result = parse.response(queryKnowledge(reader, request));
    expect(result.edges.find((edge) => edge.record === local.id)).toMatchObject({
      from: local.target,
      to: local.target,
      on: mode,
    });
    expect(result.nodes.some((node) => node.id === local.id)).toBe(false);
  });

  it.each(['u3/component/redis', null])(
    'rejects the foreign or unknown local target %s',
    (target) => {
      const records = localRecords('publish').map((record): KnowledgeRecord => {
        if (record.kind === 'interaction' && record.boundary === 'in_process') {
          return { ...record, target };
        }
        return record.id === 'test/local-contract' && record.kind === 'interface_contract'
          ? { ...record, component: target }
          : record;
      });
      expect(problems(records)).toContain('in-process target must be its execution component');
    },
  );

  it('continues to require a topic for non-local consumption', () => {
    const records = localRecords('consume').map((record): KnowledgeRecord =>
      record.kind === 'interaction' && record.boundary === 'in_process'
        ? { ...record, boundary: 'network' }
        : record,
    );
    expect(problems(records)).toContain('consumption requires a topic component');
  });

  it.each([
    ['storage', 'service'],
    ['storage', 'app'],
    ['transport', 'service'],
    ['transport', 'app'],
  ] as const)('binds a local %s resource to its %s host', (role, category) => {
    const records = localResourceRecords(role).map((record): KnowledgeRecord =>
      record.kind === 'runtime_component' && record.id === 'u3/component/mas'
        ? { ...record, category }
        : record,
    );
    expect(problems(records)).toBe('');
    expect(problems(localResourceRecords(role, false))).toContain(
      'runtime resource role does not match component category',
    );
  });

  it('rejects local resources on a separate store and local remote-interface claims', () => {
    const records = localResourceRecords('storage');
    const store = records.map((record): KnowledgeRecord =>
      record.id === 'test/local-resource' && record.kind === 'resource_binding'
        ? { ...record, component: 'u3/component/redis' }
        : record,
    );
    const remote = records.map((record): KnowledgeRecord =>
      record.id === 'test/local-resource' && record.kind === 'resource_binding'
        ? { ...record, role: 'remote_interface' }
        : record,
    );
    expect(problems(store)).toContain('in-process resources require storage or transport');
    expect(problems(remote)).toContain('in-process resources require storage or transport');
  });

  it('requires the effect resource binding to have the same locality as the interaction', () => {
    const records = publicationEffect(localResourceRecords('transport'));
    expect(problems(records)).toBe('');
    const network = records.map((record): KnowledgeRecord =>
      record.kind === 'interaction' && record.boundary === 'in_process'
        ? { ...record, boundary: 'network' }
        : record,
    );
    expect(problems(network)).toContain('effect resource requires matching runtime binding');
    expect(problems(publicationEffect(localResourceRecords('transport', false)))).toContain(
      'effect resource requires matching runtime binding',
    );
  });
});
