import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import type { QueryRequest, QueryResponse } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators, snapshotFor } from '@/infrastructure/knowledge/knowledge-format';
import {
  importKnowledgeSnapshot,
  openKnowledgeSnapshot,
} from '@/infrastructure/knowledge/knowledge-index';

import { captureProofInput } from './capture-proof-fixture';
import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { softOfferInput } from './soft-offer-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const capture = await runtimeProofInput('capture');
const soft = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();
let directory: string;
let captureDb: Awaited<ReturnType<typeof openKnowledgeSnapshot>>;
let softDb: Awaited<ReturnType<typeof openKnowledgeSnapshot>>;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'runtime-proof-'));
  await importKnowledgeSnapshot(path.join(directory, 'capture.sqlite'), {
    manifest: capture.manifest,
    bundles: [capture.bundle],
  });
  await importKnowledgeSnapshot(path.join(directory, 'soft.sqlite'), {
    manifest: soft.manifest,
    bundles: [soft.bundle],
  });
  captureDb = await openKnowledgeSnapshot(
    path.join(directory, 'capture.sqlite'),
    capture.manifest.id,
  );
  softDb = await openKnowledgeSnapshot(path.join(directory, 'soft.sqlite'), soft.manifest.id);
});
afterAll(async () => {
  captureDb.close();
  softDb.close();
  await rm(directory, { recursive: true, force: true });
});
function query(name: 'capture' | 'soft-offer', options: Partial<QueryRequest> = {}): QueryResponse {
  const database = name === 'capture' ? captureDb : softDb;
  const request = runtimeRequest(name, database.reader.snapshot, options);
  return parse.response(queryKnowledge(database.reader, parse.request(request)));
}

describe('runtime components and interaction queries', () => {
  it('validates both v3 bundles and reproduces their pinned manifests', () => {
    expect(checkKnowledge(capture.bundle)).toEqual([]);
    expect(checkKnowledge(soft.bundle)).toEqual([]);
    expect(snapshotFor([capture.bundle], 'knowledge-query/v3')).toEqual(capture.manifest);
    expect(snapshotFor([soft.bundle], 'knowledge-query/v3')).toEqual(soft.manifest);
  });
  it('preserves the original v1 and v2 authority and replay hashes', async () => {
    const originalCapture = await captureProofInput();
    const originalSoft = await softOfferInput();
    expect(snapshotFor([originalCapture.bundle])).toEqual(originalCapture.manifest);
    expect(originalCapture.manifest.id).toBe(
      '4e038cd3f646c17973646a00e4a92aeafc23ab43ac655a6dbdb6a88ed672d1cd',
    );
    expect(snapshotFor([originalSoft.bundle], 'knowledge-query/v2')).toEqual(originalSoft.manifest);
    expect(originalSoft.manifest.id).toBe(
      '13b4ead39612673f08862254d1d9c77685937d26dcd3529a09b1594c0b2bc4fa',
    );
  });
  it('shows six components and all nine source call sites in five connections', () => {
    const interactions = query('soft-offer');
    expect(interactions.nodes).toHaveLength(6);
    expect(interactions.edges).toHaveLength(9);

    expect(interactions.nodes.map((node) => node.record)).toContain(
      'u3/component/assortment-worker',
    );
    expect(interactions.nodes.some((node) => node.label.includes('KafkaProducer'))).toBe(false);
  });
  it('keeps synchronous store calls, publication and possible delivery distinct', () => {
    const result = query('soft-offer');
    expect(result.edges.find((edge) => edge.on === 'publish')).toMatchObject({
      from: 'u3/component/mas',
      to: 'u3/component/commercial-topic',
      operation: 's2/publish.attempt',
    });
    expect(result.edges.find((edge) => edge.on === 'consume')).toMatchObject({
      from: 'u3/component/commercial-topic',
      to: 'u3/component/assortment-worker',
    });
    expect(result.records.find((record) => record.id === 'u3/interaction/publish')).toMatchObject({
      waitsFor: 'producer_result',
    });
    expect(result.records.find((record) => record.id === 'u3/interaction/consume')).toMatchObject({
      waitsFor: 'handler_result',
    });
  });
  it('annotates control nodes with their actual host execution across the handoff', () => {
    const result = query('soft-offer', { query: 'continuations' });
    expect(result.nodes.find((node) => node.record === 's2/publish.attempt')).toMatchObject({
      component: 'u3/component/mas',
      execution: 'u3/runs/s2-publish',
    });
    expect(result.nodes.find((node) => node.record === 's2/consumer.cold')).toMatchObject({
      component: 'u3/component/assortment-worker',
      execution: 'u3/runs/s2-consumer',
    });
  });
  it('stops consumer reachability when channel applicability does not match', () => {
    const result = query('soft-offer', { environment: 'wrong-profile' });
    expect(result.nodes.some((node) => node.id === 'u3/component/assortment-worker')).toBe(false);
    expect(result.edges.some((edge) => edge.on === 'consume')).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
  });
  it('retains two unresolved capture boundaries and excludes candidate hosts and routes', () => {
    const result = query('capture');
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
    expect(result.nodes.filter((node) => node.record.startsWith('u3/interaction/'))).toHaveLength(
      2,
    );
    expect(
      result.records.find((record) => record.id === 'u3/contract/capture-outbound'),
    ).toMatchObject({
      component: null,
      method: null,
      path: null,
      authority: 'caller_construction',
    });
    expect(
      result.records.find((record) => record.id === 'u3/contract/candidate-client'),
    ).toMatchObject({
      component: null,
      authority: 'candidate',
      method: 'POST',
      path: '/v1/transactions/{transactionId}/psp/{psp}/capture',
    });
    expect(result.nodes.some((node) => node.label.includes('candidate.client'))).toBe(false);
  });
  it('keeps all local capture implementations inside the transaction service', () => {
    const result = query('capture', { query: 'trace' });
    expect(new Set(result.nodes.map((node) => node.component))).toEqual(
      new Set(['u3/component/transaction']),
    );
    expect(result.records.filter((record) => record.kind === 'execution_binding')).toHaveLength(4);
  });
  it('retains source DTOs, configured JSON shapes, constraints and response envelopes', () => {
    const result = query('soft-offer');
    const contract = result.records.find((record) => record.id === 'u3/contract/soft-api');
    expect(contract).toMatchObject({
      kind: 'interface_contract',
      method: 'POST',
      path: '/api/commercial-items/soft-offers',
    });
    if (contract?.kind !== 'interface_contract') throw new Error('Missing REST contract');
    expect(contract.request[0]).toMatchObject({
      shape: 'u3/shape/soft-request-wire',
      sourceShape: 'u3/shape/soft-input',
    });
    const request = result.records.find((record) => record.id === 'u3/shape/soft-request-wire');
    if (request?.kind !== 'shape') throw new Error('Missing request shape');
    expect(request.fields.find((field) => field.name === 'code')).toMatchObject({
      type: 'string',
      optional: false,
      maxLength: 200,
      pattern: '^[a-zA-Z0-9-]+$',
    });
    expect(result.records.find((record) => record.id === 'u3/shape/soft-envelope')).toMatchObject({
      representation: 'wire',
      completeness: 'partial',
    });
  });
  it('retains protobuf envelopes, field tags, reserved fields, headers and absent key', () => {
    const result = query('soft-offer');
    const contract = result.records.find((record) => record.id === 'u3/contract/soft-created');
    if (contract?.kind !== 'interface_contract') throw new Error('Missing message contract');
    expect(contract.request.find((part) => part.part === 'message')).toMatchObject({
      shape: 's2/shape/p-wire',
      presence: 'present',
    });
    expect(contract.request.find((part) => part.part === 'key')).toMatchObject({
      shape: null,
      presence: 'none',
    });
    expect(result.records.find((record) => record.id === 's2/shape/p-body')).toMatchObject({
      reservedTags: [5],
      reservedNames: ['attributeData'],
    });
    expect(result.records.some((record) => record.id === 'u3/shape/message-headers')).toBe(true);
  });
  it('returns commit-pinned GitHub links for every supporting evidence record', () => {
    for (const name of ['capture', 'soft-offer'] as const) {
      const result = query(name);
      const evidence = result.records.filter((record) => record.kind === 'evidence');
      expect(result.sourceLinks).toHaveLength(evidence.length);
      for (const record of evidence) {
        expect(result.sourceLinks?.find((link) => link.evidence === record.id)?.url).toBe(
          evidenceAnchor(record),
        );
      }
    }
  });
  it('bounds supporting records and preserves v3 runtime references across pages', () => {
    const full = query('soft-offer');
    let result = query('soft-offer', { maxRecords: 7 });
    const ids: string[] = [];
    let complete = false;
    while (!complete) {
      ids.push(...result.records.map((record) => record.id));
      expect(result.records.length).toBeLessThanOrEqual(7);
      const next = result.nextRequest;
      complete = next === null || next === undefined;
      if (next !== null && next !== undefined) {
        result = parse.response(queryKnowledge(softDb.reader, parse.request(next)));
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.toSorted((a, b) => a.localeCompare(b))).toEqual(
      full.records.map((record) => record.id).toSorted((a, b) => a.localeCompare(b)),
    );
  });
  it('rejects v3 records under earlier query rules before publication', async () => {
    const manifest = snapshotFor([soft.bundle], 'knowledge-query/v2');
    await expect(
      importKnowledgeSnapshot('/invalid/index.sqlite', { manifest, bundles: [soft.bundle] }),
    ).rejects.toThrow('V3 bundles');
  });
  it('includes the new runtime schemas in the archived-version isolation checks', async () => {
    const archived: unknown = JSON.parse(await readFile('schema/knowledge-v2.schema.json', 'utf8'));
    expect(archived).toHaveProperty('$id', 'https://groundwork.local/schema/knowledge-v2');
    expect(() => parse.bundle({ ...soft.bundle, format: 'groundwork-knowledge/v2' })).toThrow(
      'KnowledgeBundle',
    );
  });
});
