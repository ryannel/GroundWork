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
// Synthetic associations test discoverability; they do not change original source facts.
const related: KnowledgeRecord[] = [
  {
    id: 'related/claim',
    kind: 'claim',
    owner: 's2/add',
    statement: 'Related source declaration, not a proven execution',
    basis: 'source_declared',
    inputs: ['s2/consumer'],
    assumptions: ['Registration does not prove invocation'],
    evidence: ['s2/e/add'],
  },
  {
    id: 'related/gap',
    kind: 'gap',
    owner: 's2/add',
    obligation: 'source-policy',
    reason: 'Invocation policy is not established',
    action: 'Inspect the policy before joining execution',
    evidence: ['s2/e/add'],
  },
  {
    id: 'related/coverage',
    kind: 'coverage',
    owner: 's2/add',
    obligation: 'source-review',
    status: 'partial',
    scope: 'Source declaration association is retained',
    gaps: ['related/gap'],
    evidence: ['s2/e/add'],
  },
  {
    id: 'related/entry-claim',
    kind: 'claim',
    owner: 's2/endpoint',
    statement: 'Entry registration association',
    basis: 'source_declared',
    inputs: ['s2/add'],
    assumptions: [],
    evidence: ['s2/e/controller'],
  },
];
const records = [...bundle.records, ...related];
const byId = new Map(records.map((record) => [record.id, record]));
const reader: KnowledgeReader = {
  snapshot: 'related-source-facts',
  rules: 'knowledge-query/v3',
  get: (id) => byId.get(id),
  select: (field, value) =>
    records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
};
function request(options: Partial<QueryRequest> = {}): QueryRequest {
  return runtimeRequest('soft-offer', reader.snapshot, {
    query: 'records',
    ids: ['s2/add'],
    ...options,
  });
}

describe('related source facts', () => {
  it.each([
    'source_revision',
    'shape',
    'resource',
    'runtime_component',
    'interface_contract',
    'channel_binding',
    'subscription',
  ])('anchors declaration facts to their actual %s catalogue record', (kind) => {
    const owner = bundle.records.find((record) => record.kind === kind);
    if (owner === undefined) throw new Error(`Missing catalogue fixture: ${kind}`);
    const declaration = related.map((record) => ({ ...record, owner: owner.id }));
    const scopedRecords = [...bundle.records, ...declaration];
    const scopedById = new Map(scopedRecords.map((record) => [record.id, record]));
    const scopedReader: KnowledgeReader = {
      ...reader,
      get: (id) => scopedById.get(id),
      select: (field, value) =>
        scopedRecords.filter(
          (record) => recordIndexes(record).get(field)?.includes(value) === true,
        ),
    };
    expect(checkKnowledge(parse.bundle({ ...bundle, records: scopedRecords }))).toEqual([]);
    const result = queryKnowledge(scopedReader, request({ ids: [owner.id] }));
    expect(result.records.some((record) => record.id === 'related/claim')).toBe(true);
    expect(result.claims).not.toContain('related/claim');
  });

  it('rejects metadata as a declaration owner and preserves executable ownership rules', () => {
    const wrongOwner = related.map((record) => ({ ...record, owner: 's2/e/add' }));
    const invalid = [...bundle.records, ...wrongOwner];
    expect(checkKnowledge(parse.bundle({ ...bundle, records: invalid }))).toContain(
      'related/claim: invalid owner kind',
    );
    const operation = bundle.records.find((record) => record.kind === 'operation');
    if (operation === undefined) throw new Error('Missing operation fixture');
    const moved = invalid.map((record) =>
      record.id === operation.id ? { ...operation, owner: 's2/shape/input' } : record,
    );
    expect(checkKnowledge(parse.bundle({ ...bundle, records: moved }))).toContain(
      `${operation.id}: invalid owner kind`,
    );
  });

  it('keeps associations structurally valid', () => {
    expect(checkKnowledge(parse.bundle({ ...bundle, records }))).toEqual([]);
  });

  it('keeps repository catalogue facts out of incidental provenance closure', () => {
    const declaration = related.find((record) => record.kind === 'claim');
    if (declaration === undefined) throw new Error('Missing declaration fixture');
    const revisionClaim: KnowledgeRecord = {
      ...declaration,
      id: 'revision/claim',
      owner: 's2/p',
    };
    const scopedRecords = [...records, revisionClaim];
    const scopedById = new Map(scopedRecords.map((record) => [record.id, record]));
    const scopedReader: KnowledgeReader = {
      ...reader,
      get: (id) => scopedById.get(id),
      select: (field, value) =>
        scopedRecords.filter(
          (record) => recordIndexes(record).get(field)?.includes(value) === true,
        ),
    };
    const result = queryKnowledge(scopedReader, request({ ids: ['s2/add'] }));
    expect(result.records.some((record) => record.id === 's2/p')).toBe(true);
    expect(result.records.some((record) => record.id === 'revision/claim')).toBe(false);
    const direct = queryKnowledge(scopedReader, request({ ids: ['s2/p'] }));
    expect(direct.records.some((record) => record.id === 'revision/claim')).toBe(true);
    let next: QueryRequest | null = request({ ids: ['s2/add'], maxRecords: 7 });
    let pages = 0;
    while (next !== null && pages < 200) {
      const page = parse.response(queryKnowledge(scopedReader, next));
      expect(page.records.some((record) => record.id === 'revision/claim')).toBe(false);
      expect(page.nextRequest?.associationOwners ?? ['s2/add']).toEqual(['s2/add']);
      next = page.nextRequest ?? null;
      pages += 1;
    }
    expect(next).toBeNull();
  });

  it('discovers method claims, coverage and gaps through the known implementation', () => {
    const result = queryKnowledge(reader, request());
    const ids = result.records.map((record) => record.id);
    expect(ids).toEqual(
      expect.arrayContaining(['related/claim', 'related/coverage', 'related/gap', 's2/consumer']),
    );
    expect(result.claims).not.toContain('related/claim');
  });

  it('discovers entry declarations without a new listing endpoint', () => {
    const result = queryKnowledge(reader, request({ ids: ['s2/endpoint'] }));
    expect(result.records.some((record) => record.id === 'related/entry-claim')).toBe(true);
  });

  it('keeps related source declarations separate from control execution', () => {
    const result = queryKnowledge(reader, request({ query: 'trace', ids: [] }));
    expect(result.records.some((record) => record.id === 'related/claim')).toBe(true);
    expect(result.nodes.some((node) => node.record === 's2/consumer.entry')).toBe(false);
    expect(result.claims).not.toContain('related/claim');
  });

  it('paginates related closure under the existing hard record budget without duplicates', () => {
    let next: QueryRequest | null = request({ maxRecords: 7 });
    const seen = new Set<string>();
    let pages = 0;
    while (next !== null && pages < 200) {
      const result = parse.response(queryKnowledge(reader, next));
      expect(result.records.length).toBeLessThanOrEqual(7);
      for (const record of result.records) {
        expect(seen.has(record.id)).toBe(false);
        seen.add(record.id);
      }
      next = result.nextRequest ?? null;
      pages += 1;
    }
    expect(next).toBeNull();
    expect(pages).toBeGreaterThan(1);
    expect(seen.has('related/claim')).toBe(true);
    expect(seen.has('related/coverage')).toBe(true);
    expect(seen.has('related/gap')).toBe(true);
  });

  it('deduplicates repeated requested records when preserving association owners across pages', () => {
    const selection = parse.request(request({ ids: ['s2/add', 's2/add'], maxRecords: 1 }));
    const first = parse.response(queryKnowledge(reader, selection));
    expect(first.nextRequest?.associationOwners).toEqual(['s2/add']);
    let next = first.nextRequest;
    let pages = 0;
    const seen = new Set(first.records.map((record) => record.id));
    while (next !== null && next !== undefined && pages < 200) {
      const page = parse.response(queryKnowledge(reader, parse.request(next)));
      for (const record of page.records) {
        expect(seen.has(record.id)).toBe(false);
        seen.add(record.id);
      }
      expect(page.nextRequest?.associationOwners ?? ['s2/add']).toEqual(['s2/add']);
      next = page.nextRequest;
      pages += 1;
    }
    expect(next).toBeNull();
    expect(seen.has('related/claim')).toBe(true);
    expect(seen.has('related/coverage')).toBe(true);
    expect(seen.has('related/gap')).toBe(true);
  });
});
