import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import type { KnowledgeBundle, QueryRequest } from '@/domain/knowledge/knowledge.generated';
import {
  knowledgeDigest,
  knowledgeValidators,
  snapshotFor,
} from '@/infrastructure/knowledge/knowledge-format';
import {
  importKnowledgeSnapshot,
  openKnowledgeSnapshot,
} from '@/infrastructure/knowledge/knowledge-index';

import { captureProofInput, captureRequest } from './capture-proof-fixture';
import { generateKnowledgeTypes } from './generate-knowledge-types';

vi.mock(import('server-only'), () => ({}));

const directory = await mkdtemp(path.join(os.tmpdir(), 'capture-proof-'));
const input = await captureProofInput();
const parse = await knowledgeValidators();
const file = path.join(directory, 'proof.sqlite');
let database: Awaited<ReturnType<typeof openKnowledgeSnapshot>>;
beforeAll(async () => {
  await importKnowledgeSnapshot(file, { manifest: input.manifest, bundles: [input.bundle] });
  database = await openKnowledgeSnapshot(file, input.manifest.id);
});
afterAll(async () => {
  database.close();
  await rm(directory, { recursive: true, force: true });
});

const request = (options: Partial<QueryRequest> = {}) => captureRequest(input.manifest.id, options);
const query = (options: Partial<QueryRequest> = {}) =>
  parse.response(queryKnowledge(database.reader, request(options)));

async function changedReader(bundle: KnowledgeBundle) {
  const manifest = snapshotFor([bundle]);
  await importKnowledgeSnapshot(file, { manifest, bundles: [bundle] });
  return { ...(await openKnowledgeSnapshot(file, manifest.id)), manifest };
}

function invocationBundle() {
  const bundle = structuredClone(input.bundle);
  const original = bundle.records.find((record) => record.id === 'r1/controller.invoke');
  if (original?.kind !== 'operation') throw new Error('Missing fixture call');
  const second = structuredClone(original);
  second.id = 'r1/controller.invoke-again';
  second.bindings = second.bindings.map((binding) => ({
    ...binding,
    value: binding.parameter.endsWith('attributes')
      ? 'r1/value/normalised-attributes'
      : binding.value,
  }));
  bundle.records.push(second, {
    kind: 'value',
    id: 'r1/value/normalised-attributes',
    owner: 'r1/controller',
    definition: second.id,
    label: 'new attributes definition after mutation',
    role: 'definition',
    accessPath: [],
    representation: 'source',
    shape: null,
    evidence: ['r1/evidence/controller'],
  });
  return bundle;
}

describe('capture knowledge proof', () => {
  it('generates domain types from the canonical schema without drift', async () => {
    await expect(generateKnowledgeTypes()).resolves.toBe(
      await readFile('src/domain/knowledge/knowledge.generated.ts', 'utf8'),
    );
  });

  it('accepts the pinned fixture and rejects unknown fields', () => {
    expect(checkKnowledge(input.bundle)).toEqual([]);
    expect(() => parse.bundle({ ...input.bundle, invented: true })).toThrow('KnowledgeBundle');
    expect(() => parse.request(request({ query: 'outcome' }))).toThrow('QueryRequest');
    expect(() => parse.request(request({ query: 'value' }))).toThrow('QueryRequest');
  });

  it('keeps candidate implementations out of established traversal', () => {
    const result = query();
    expect(result.nodes.some((node) => node.record.startsWith('r1/candidate.'))).toBe(false);
    expect(
      result.frontiers.filter((frontier) => frontier.reason === 'version_unresolved'),
    ).toHaveLength(2);
    expect(result.edges.some((edge) => edge.assumption?.includes('capture.session') === true)).toBe(
      true,
    );
  });

  it('explains historical completion through the helper and controller catch', () => {
    const result = query({ query: 'outcome', outcome: 208 });
    const ids = result.nodes.map((node) => node.record);
    expect(ids).toContain('r1/predicate.history');
    expect(ids).toContain('r1/validator.throw');
    expect(ids).toContain('r1/controller.208');
    expect(ids).not.toContain('r1/capture.remote');
    expect(result.claims).toEqual(['r1/claim/208']);
    expect(result.frontiers).toHaveLength(1);
    expect(result.edges.some((edge) => edge.on === 'AlreadyCompleted')).toBe(true);
    expect(result.feasibility).toBe('not_checked');
    expect(result.exhaustive).toBe(false);
  });

  it('separates non-null stage rejection from a failure constructing its message', () => {
    const invalid = query({ query: 'outcome', outcome: 422 });
    const failure = query({ query: 'outcome', outcome: 500 });
    expect(invalid.nodes.map((node) => node.record)).toContain('r1/capture.rejectStage');
    expect(invalid.nodes.map((node) => node.record)).not.toContain('r1/capture.nullStage');
    expect(failure.nodes.map((node) => node.record)).toContain('r1/capture.nullStage');
    expect(failure.edges.some((edge) => edge.condition === 'stage == null')).toBe(true);
    expect(failure.nodes.map((node) => node.record)).toContain('r1/controller.500');
  });

  it('retains null-wrapper evaluation even though response data is discarded', () => {
    const failure = query({ query: 'outcome', outcome: 500 });
    const success = query({ query: 'outcome', outcome: 202 });
    expect(failure.nodes.map((node) => node.record)).toContain('r1/capture.nullWrapper');
    expect(success.nodes.map((node) => node.record)).toContain('r1/capture.data');
    expect(success.nodes.map((node) => node.record)).not.toContain('r1/capture.nullWrapper');
    expect(success.claims).toEqual(['r1/claim/202']);
    expect(
      success.records.some((record) => record.kind === 'gap' && record.obligation === 'completion'),
    ).toBe(true);
  });

  it('traces the provider reference to the persisted field while preserving inherited uncertainty', () => {
    const result = query({
      query: 'value',
      value: 'r1/value/outgoing.pspTransactionId',
      context: ['r1/controller.invoke'],
    });
    expect(result.nodes.map((node) => node.record)).toEqual([
      'r1/value/outgoing.pspTransactionId',
      'r1/value/capture.externalId',
      'r1/value/capture.persistedExternalId',
    ]);
    expect(result.frontiers.every((frontier) => frontier.reason === 'version_unresolved')).toBe(
      true,
    );
    expect(result.edges.every((edge) => edge.assumption !== null)).toBe(true);
  });

  it('does not equate explicit constructed assignments with a complete wire body', () => {
    const result = query({
      query: 'value',
      value: 'r1/value/outgoing.attributes',
      context: ['r1/controller.invoke'],
      representation: 'wire',
    });
    expect(result.nodes.map((node) => node.record)).toContain('r1/value/controller.attributes');
    expect(
      result.frontiers.some((frontier) => frontier.reason === 'representation_unresolved'),
    ).toBe(true);
    expect(
      result.records.some(
        (record) => record.kind === 'shape' && record.representation === 'constructed',
      ),
    ).toBe(true);
  });

  it('does not mix two invocations of a shared implementation or old and mutated definitions', async () => {
    const selected = await changedReader(invocationBundle());
    try {
      const common = { query: 'value' as const, value: 'r1/value/outgoing.attributes' };
      const first = queryKnowledge(
        selected.reader,
        captureRequest(selected.manifest.id, { ...common, context: ['r1/controller.invoke'] }),
      );
      const second = queryKnowledge(
        selected.reader,
        captureRequest(selected.manifest.id, {
          ...common,
          context: ['r1/controller.invoke-again'],
        }),
      );
      expect(first.nodes.map((node) => node.record)).toContain('r1/value/controller.attributes');
      expect(first.nodes.map((node) => node.record)).not.toContain(
        'r1/value/normalised-attributes',
      );
      expect(second.nodes.map((node) => node.record)).toContain('r1/value/normalised-attributes');
      expect(second.nodes.map((node) => node.record)).not.toContain(
        'r1/value/controller.attributes',
      );
    } finally {
      selected.close();
    }
  });

  it('rejects invented or unresolved invocation contexts', () => {
    expect(() =>
      query({ query: 'value', value: 'r1/value/outgoing.attributes', context: [] }),
    ).toThrow('invocation context');
    expect(() =>
      query({
        query: 'value',
        value: 'r1/value/outgoing.attributes',
        context: ['r1/capture.remote'],
      }),
    ).toThrow('Invalid or unresolved');
  });

  it('reports examined effects without promoting absence into a global negative', () => {
    const result = query({ query: 'effects' });
    expect(result.findings[0]?.statement).toContain('Unresolved calls have unknown effects');
    expect(result.findings[0]?.support).toContain('r1/effect/transaction');
    expect(result.records.find((record) => record.id === 'r1/resource/transactions')).toMatchObject(
      { physicalLocation: null },
    );
  });

  it('reports query truncation separately from knowledge frontiers', () => {
    const result = query({ maxNodes: 4 });
    expect(result.nodes).toHaveLength(4);
    expect(result.limitsHit).toEqual(['maxNodes']);
    expect(result.traversalComplete).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'query_limit')).toBe(true);
    expect(result.frontiers.some((frontier) => frontier.reason === 'version_unresolved')).toBe(
      true,
    );
    expect(query().traversalComplete).toBe(true);
  });

  it('invalidates dependent explanations after helper or dependency metadata changes', () => {
    for (const changed of ['r1/evidence/completed', 'r1/evidence/dependencies']) {
      const result = query({ query: 'impact', changed: [changed] });
      expect(result.nodes.map((node) => node.record)).toContain('r1/claim/208');
      expect(result.nodes.map((node) => node.record)).toContain('r1/endpoint');
      expect(result.findings[0]?.statement).toContain(
        'does not demonstrate runtime incompatibility',
      );
    }
  });

  it('keeps answers identical after rebuilding the database', async () => {
    const rebuilt = path.join(directory, 'rebuilt.sqlite');
    await importKnowledgeSnapshot(rebuilt, { manifest: input.manifest, bundles: [input.bundle] });
    const other = await openKnowledgeSnapshot(rebuilt, input.manifest.id);
    try {
      expect(queryKnowledge(other.reader, request())).toEqual(query());
    } finally {
      other.close();
    }
  });

  it('does not replace the old snapshot when a failed or modified bundle is imported', async () => {
    const changed = structuredClone(input.bundle);
    changed.records.pop();
    await expect(
      importKnowledgeSnapshot(file, { manifest: input.manifest, bundles: [changed] }),
    ).rejects.toThrow('Bundle digest mismatch');
    expect(query().nodes.length).toBeGreaterThan(20);
    await expect(openKnowledgeSnapshot(file, 'unknown')).rejects.toThrow('Unknown snapshot');
    expect(() => queryKnowledge(database.reader, request({ snapshot: 'other' }))).toThrow(
      'snapshot does not match',
    );
  });

  it('rejects dangling references, duplicate IDs, and invented cross-revision local resolution', () => {
    const bundle = structuredClone(input.bundle);
    bundle.records.push(bundle.records[0]!);
    expect(checkKnowledge(bundle)).toContain('Duplicate revision record IDs');
    const resolution = bundle.records.find((record) => record.id === 'r1/resolve.client');
    if (resolution?.kind !== 'resolution') throw new Error('Missing resolution');
    resolution.basis = 'source_local';
    resolution.target = 'r1/candidate.client';
    expect(checkKnowledge(bundle).join(' ')).toContain('cannot cross source revisions');
    resolution.target = 'missing';
    expect(checkKnowledge(bundle).join(' ')).toContain('missing reference missing');
  });

  it('does not promote candidate artifact correspondence to verified without an exact binding and digest', () => {
    const bundle = structuredClone(input.bundle);
    const resolution = bundle.records.find((record) => record.id === 'r1/resolve.client');
    if (resolution?.kind !== 'resolution') throw new Error('Missing resolution');
    resolution.basis = 'artifact_verified';
    resolution.target = 'r1/candidate.client';
    resolution.binding = 'r1/binding/client';
    expect(checkKnowledge(bundle).join(' ')).toContain('requires exact artifact digest');
  });

  it('hashes object key order consistently and detects semantic changes', () => {
    expect(knowledgeDigest({ b: 2, a: 1 })).toBe(knowledgeDigest({ a: 1, b: 2 }));
    expect(knowledgeDigest({ a: 2 })).not.toBe(knowledgeDigest({ a: 1 }));
  });
});
