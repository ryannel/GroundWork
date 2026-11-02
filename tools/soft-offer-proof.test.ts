import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import type { QueryRequest, QueryResponse } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators, snapshotFor } from '@/infrastructure/knowledge/knowledge-format';
import {
  importKnowledgeSnapshot,
  openKnowledgeSnapshot,
} from '@/infrastructure/knowledge/knowledge-index';

import { captureProofInput } from './capture-proof-fixture';
import { softOfferDrawing } from './soft-offer-proof-drawing';
import { softOfferInput, softOfferRequest } from './soft-offer-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const input = await softOfferInput();
const parse = await knowledgeValidators();
let directory: string;
let database: Awaited<ReturnType<typeof openKnowledgeSnapshot>>;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'soft-offer-proof-'));
  const file = path.join(directory, 'index.sqlite');
  await importKnowledgeSnapshot(file, { manifest: input.manifest, bundles: [input.bundle] });
  database = await openKnowledgeSnapshot(file, input.manifest.id);
});
afterAll(async () => {
  database.close();
  await rm(directory, { recursive: true, force: true });
});
function query(options: Partial<QueryRequest> = {}): QueryResponse {
  return parse.response(
    queryKnowledge(database.reader, parse.request(softOfferRequest(input.manifest.id, options))),
  );
}
function reachable(
  result: QueryResponse,
  from: string,
  to: string,
  avoid: readonly string[] = [],
): boolean {
  const pending = result.nodes.filter((node) => node.record === from).map((node) => node.id);
  const seen = new Set<string>();
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node = result.nodes.find((candidate) => candidate.id === id);
    if (node !== undefined && !avoid.includes(node.record)) {
      if (node.record === to) return true;
      pending.push(...result.edges.filter((edge) => edge.from === id).map((edge) => edge.to));
    }
  }
  return false;
}

describe('soft-offer source proof', () => {
  it('validates the canonical extension and reproduces its snapshot', () => {
    expect(checkKnowledge(input.bundle)).toEqual([]);
    expect(snapshotFor([input.bundle], 'knowledge-query/v2')).toEqual(input.manifest);
    expect(input.bundle.records.filter((record) => record.kind === 'evidence')).toHaveLength(43);
  });
  it('keeps the original capture manifest unchanged under its original rules', async () => {
    const capture = await captureProofInput();
    expect(snapshotFor([capture.bundle])).toEqual(capture.manifest);
    expect(capture.manifest.id).toBe(
      '4e038cd3f646c17973646a00e4a92aeafc23ab43ac655a6dbdb6a88ed672d1cd',
    );
  });
  it('keeps the consumer outside a local HTTP trace', () => {
    const result = query({ query: 'trace' });
    expect(result.nodes.some((node) => node.record.startsWith('s2/consumer.'))).toBe(false);
    expect(result.nodes.some((node) => node.record === 's2/add.saved')).toBe(true);
  });
  it('shows a Created route that skips publication after a save', () => {
    const result = query({ query: 'outcome', outcome: 201 });
    expect(reachable(result, 's2/add.saved', 's2/http.201', ['s2/publish.attempt'])).toBe(true);
    expect(result.edges.some((edge) => edge.condition === 'Notifications disabled')).toBe(true);
    expect(result.edges.some((edge) => edge.condition === 'Refetch is not success with data')).toBe(
      true,
    );
  });
  it('does not turn a non-persisted broker report into an HTTP error', () => {
    const result = query({ query: 'trace' });
    expect(reachable(result, 's2/publish.not-persisted', 's2/http.201')).toBe(true);
    expect(reachable(result, 's2/publish.not-persisted', 's2/http.500')).toBe(false);
  });
  it('preserves a publish exception after save on the 500 slice', () => {
    const result = query({ query: 'outcome', outcome: 500 });
    expect(reachable(result, 's2/add.saved', 's2/publish.error')).toBe(true);
    expect(reachable(result, 's2/publish.error', 's2/http.500')).toBe(true);
    expect(
      result.edges.some(
        (edge) =>
          edge.on === 'error' && edge.assumption?.includes('unresolved dependency') === true,
      ),
    ).toBe(true);
  });
  it('never resumes an asynchronous consumer into the HTTP stack', () => {
    const result = query();
    expect(result.edges.filter((edge) => edge.on === 'possible_delivery')).toHaveLength(1);
    expect(reachable(result, 's2/consumer.failed', 's2/http.201')).toBe(false);
    expect(reachable(result, 's2/consumer.failed', 's2/http.500')).toBe(false);
    expect(
      result.nodes
        .filter((node) => node.record.startsWith('s2/consumer.'))
        .every((node) => node.context.at(-1) === 's2/handoff'),
    ).toBe(true);
  });
  it('separates staging and wrapper acknowledgements from runtime observations', () => {
    const result = query({ query: 'consistency' });
    expect(result.records.find((record) => record.id === 's2/write/save')).toMatchObject({
      stagedAt: 's2/add.stage',
      acknowledgedAt: 's2/add.saved',
      acknowledgement: 'normal_return',
    });
    expect(result.records.find((record) => record.id === 's2/write/hot')).toMatchObject({
      acknowledgement: 'success_result',
      condition: expect.stringContaining('boolean') as unknown,
    });
    expect(result.records.filter((record) => record.kind === 'consistency_boundary')).toHaveLength(
      2,
    );
    expect(result.records.find((record) => record.id === 's2/milestone/response')).toMatchObject({
      meaning: expect.stringContaining('does not require') as unknown,
    });
  });
  it('requires cold success before hot write but preserves cold success on hot failure', () => {
    const result = query();
    expect(reachable(result, 's2/consumer.cold', 's2/consumer.hot', ['s2/consumer.cold-ok'])).toBe(
      false,
    );
    expect(reachable(result, 's2/consumer.cold-ok', 's2/consumer.failed')).toBe(true);
    expect(
      result.edges.some(
        (edge) => edge.condition === 'Redis wrapper Result failed after cold success',
      ),
    ).toBe(true);
  });
  it('records cold-read hydration whose failed Result is ignored', () => {
    const result = query({ query: 'consistency' });
    expect(result.records.find((record) => record.id === 's2/write/hydrate')).toMatchObject({
      acknowledgement: 'ignored_result',
      acknowledgedAt: 's2/consumer.deserialise',
    });
    expect(
      result.edges.some(
        (edge) => edge.condition === 'Await returns regardless of hydration Result success',
      ),
    ).toBe(true);
    expect(reachable(result, 's2/consumer.hydrate', 's2/consumer.upsert')).toBe(true);
  });
  it('keeps entity upsert distinct from message deduplication and offset policy', () => {
    const result = query({ query: 'consistency' });
    expect(result.records.find((record) => record.id === 's2/policy/consumer')).toMatchObject({
      deduplication: 'entity_upsert',
      deduplicationKeys: ['s2/v/entity-id'],
      offsetCommit: 'unresolved',
      retryLimit: null,
      deliveryGuarantee: 'not_established',
    });
    expect(result.records.find((record) => record.id === 's2/handoff')).toMatchObject({
      partitionKey: 'null',
      awaitsConsumer: false,
      correlation: [
        {
          header: 'id',
          purpose: 'trace_correlation',
          consumerUse: 'not_read_in_inspected_processor',
          value: 's2/v/correlation',
        },
      ],
    });
  });
  it('traces a cached field through the message and formal argument bindings', () => {
    const result = query({
      query: 'value',
      value: 's2/v/cached-name',
      context: ['s2/http.add', 's2/add.notify', 's2/notify.send', 's2/handoff'],
      representation: 'persisted',
    });
    expect(result.nodes.map((node) => node.record)).toEqual([
      's2/v/cached-name',
      's2/v/received-name',
      's2/v/wire-name',
      's2/v/created-name',
      's2/v/notice-name',
      's2/v/saved-name',
      's2/v/entity-name',
      's2/v/input-name',
    ]);
    expect(result.edges.find((edge) => edge.record === 's2/handoff')).toMatchObject({
      condition: expect.stringContaining('tag 3') as unknown,
    });
    expect(
      result.frontiers.some((frontier) => frontier.references.includes('s2/gap/mapping')),
    ).toBe(true);
  });
  it('keeps source addressing and wire tags without claiming a deployed location', () => {
    const result = query({ query: 'consistency' });
    expect(result.records.find((record) => record.id === 's2/blob')).toMatchObject({
      physicalLocation: null,
      address: { container: 'upstream-entities', path: '/upstream-entities' },
    });
    expect(result.records.find((record) => record.id === 's2/write/save')).toMatchObject({
      fields: expect.arrayContaining([
        {
          path: ['Name'],
          value: 's2/v/entity-name',
          transform: 'Wrapper Value converter or direct scalar mapping declared by EF model',
        },
      ]) as unknown,
    });
    expect(result.records.find((record) => record.id === 's2/shape/upstream')).toMatchObject({
      container: 'array',
      items: 's2/shape/upstream-entity',
    });
    expect(result.records.find((record) => record.id === 's2/shape/p-body')).toMatchObject({
      reservedTags: [5],
      reservedNames: ['attributeData'],
    });
  });
  it('stops at an environment mismatch rather than joining a similarly named topic', () => {
    const result = query({ environment: 'test-profile' });
    expect(result.nodes.some((node) => node.record.startsWith('s2/consumer.'))).toBe(false);
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
  });
  it('invalidates the handoff when either source schema or profile changes', () => {
    for (const id of [
      's2/e/consumer-proto',
      's2/e/producer-proto',
      's2/e/prod-config',
      's2/e/consumer-base-config',
    ]) {
      const result = query({ query: 'impact', changed: [id], maxNodes: 1000 });
      expect(result.nodes.some((node) => node.record === 's2/handoff')).toBe(true);
    }
  });
  it('bounds graph expansion and records independently', () => {
    const result = query({ maxNodes: 30, maxRecords: 14 });
    expect(result.nodes.length).toBeLessThanOrEqual(30);
    expect(result.records).toHaveLength(14);
    expect(result.limitsHit).toEqual(expect.arrayContaining(['maxNodes', 'maxRecords']));
    expect(result.traversalComplete).toBe(false);
  });
  it('pages supporting records with no duplicates or missing closure', () => {
    const full = query({ query: 'consistency' });
    const loaded: string[] = [];
    let result = query({ query: 'consistency', maxRecords: 9 });
    let complete = false;
    while (!complete) {
      expect(result.records.length).toBeLessThanOrEqual(9);
      loaded.push(...result.records.map((record) => record.id));
      complete = result.nextRequest === null || result.nextRequest === undefined;
      if (result.nextRequest === null || result.nextRequest === undefined) break;
      expect(result.nextRequest.snapshot).toBe(input.manifest.id);
      result = queryKnowledge(database.reader, parse.request(result.nextRequest));
    }
    expect(new Set(loaded).size).toBe(loaded.length);
    expect(loaded.toSorted((a, b) => a.localeCompare(b))).toEqual(
      full.records.map((record) => record.id).toSorted((a, b) => a.localeCompare(b)),
    );
    expect(result.traversalComplete).toBe(true);
  });
  it('rejects a query rule mismatch and an invalid continuation request', () => {
    expect(() =>
      queryKnowledge(database.reader, {
        ...softOfferRequest(input.manifest.id),
        format: 'groundwork-query/v1',
      }),
    ).toThrow('rules');
    expect(() =>
      parse.request({ ...softOfferRequest(input.manifest.id), query: 'records', ids: [] }),
    ).toThrow('QueryRequest');
  });
  it('accounts for every operation in the collapsed visual projection', () => {
    const result = query();
    expect(softOfferDrawing(result)).toContain('Skip publication');
    expect(() =>
      softOfferDrawing({
        ...result,
        nodes: [
          ...result.nodes,
          { id: 'new-operation', record: 'unknown', context: [], label: 'Ungrouped' },
        ],
      }),
    ).toThrow('Ungrouped proof operations');
  });
  it('rebuilds the disposable SQLite projection with identical answers', async () => {
    const file = path.join(directory, 'rebuilt.sqlite');
    await importKnowledgeSnapshot(file, { manifest: input.manifest, bundles: [input.bundle] });
    const rebuilt = await openKnowledgeSnapshot(file, input.manifest.id);
    try {
      expect(queryKnowledge(rebuilt.reader, softOfferRequest(input.manifest.id))).toEqual(query());
    } finally {
      rebuilt.close();
    }
  });
});
