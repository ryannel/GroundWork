import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import { recordReferences } from '@/domain/knowledge/knowledge-references';
import type {
  KnowledgeBundle,
  KnowledgeRecord,
  StorageWrite,
} from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators, snapshotFor } from '@/infrastructure/knowledge/knowledge-format';
import {
  importKnowledgeSnapshot,
  openKnowledgeSnapshot,
} from '@/infrastructure/knowledge/knowledge-index';

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { softOfferInput } from './soft-offer-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const legacy = await softOfferInput();
const parse = await knowledgeValidators();
const original = bundle.records.find((record) => record.id === 's2/write/save');
if (original?.kind !== 'storage_write') throw new Error('Missing storage write fixture');
const write = original;
const frame = ['s2/http.add'];
let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'storage-context-'));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

function contextualWrite(): StorageWrite {
  return {
    ...write,
    owner: 's2/http',
    effectContext: [...frame],
    stagedContext: [...frame],
    acknowledgedContext: [...frame],
    fields: write.fields.map((field) => ({ ...field, context: [...frame] })),
  };
}

function recordsFor(
  replacement: StorageWrite,
  change: (record: KnowledgeRecord) => KnowledgeRecord = (record) => record,
): KnowledgeRecord[] {
  return bundle.records.map((record) => (record.id === write.id ? replacement : change(record)));
}

function problems(
  replacement: StorageWrite,
  change?: (record: KnowledgeRecord) => KnowledgeRecord,
): string[] {
  return checkKnowledge(parse.bundle({ ...bundle, records: recordsFor(replacement, change) }));
}

function readerFor(records: readonly KnowledgeRecord[]): KnowledgeReader {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    snapshot: 'storage-context',
    rules: 'knowledge-query/v3',
    get: (id) => byId.get(id),
    select: (field, value) =>
      records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}

function expectWriteProblem(
  replacement: StorageWrite,
  change?: (record: KnowledgeRecord) => KnowledgeRecord,
): void {
  expect(problems(replacement, change).some((problem) => problem.includes(write.id))).toBe(true);
}

describe('storage write call contexts', () => {
  it('keeps original same-owner writes valid without context properties', () => {
    expect(checkKnowledge(bundle)).toEqual([]);
    expect(problems(write)).toEqual([]);
    expect(
      problems({
        ...write,
        effectContext: [],
        stagedContext: [],
        acknowledgedContext: [],
        fields: write.fields.map((field) => ({ ...field, context: [] })),
      }),
    ).toEqual([]);
  });

  it('imports and serves the actual same-host caller-to-callee write association', async () => {
    const contextual = contextualWrite();
    const input: KnowledgeBundle = { ...bundle, records: recordsFor(contextual) };
    expect(checkKnowledge(parse.bundle(input))).toEqual([]);
    const manifest = snapshotFor([input], 'knowledge-query/v3');
    const databasePath = path.join(directory, 'context.sqlite');
    await expect(
      importKnowledgeSnapshot(databasePath, { manifest, bundles: [input] }),
    ).resolves.toBeUndefined();
    const database = await openKnowledgeSnapshot(databasePath, manifest.id);
    try {
      const result = queryKnowledge(
        database.reader,
        runtimeRequest('soft-offer', manifest.id, { query: 'consistency' }),
      );
      expect(result.records.find((record) => record.id === write.id)).toEqual(contextual);
      expect(result.records.some((record) => record.id === frame[0])).toBe(true);
      expect(result.limitsHit).toEqual([]);
    } finally {
      database.close();
    }
  });

  it.each(['effectContext', 'stagedContext', 'acknowledgedContext'] as const)(
    'requires an explicit %s when the terminal record belongs to the callee',
    (property) => {
      const replacement = contextualWrite();
      const { [property]: omitted, ...withoutContext } = replacement;
      expect(omitted).toEqual(frame);
      expectWriteProblem(withoutContext);
      expectWriteProblem({ ...contextualWrite(), [property]: [] });
    },
  );

  it('requires a separate context for every callee-owned field value', () => {
    const replacement = contextualWrite();
    replacement.fields = replacement.fields.map((field, index) => {
      if (index !== 0) return field;
      const { context, ...withoutContext } = field;
      expect(context).toEqual(frame);
      return withoutContext;
    });
    expectWriteProblem(replacement);
  });

  it('rejects a field whose terminal owner differs from its declared context', () => {
    const replacement = contextualWrite();
    replacement.fields = replacement.fields.map((field, index) =>
      index === 0 ? { ...field, value: 's2/v/request' } : field,
    );
    expectWriteProblem(replacement);
  });

  it.each([
    ['missing call', ['review/missing']],
    ['non-call operation', ['s2/http.start']],
    ['callee frame without caller frame', ['s2/add.notify']],
    ['repeated caller frame', ['s2/http.add', 's2/http.add']],
    ['sibling terminal implementation', ['s2/http.add', 's2/add.notify']],
    ['handoff', [bundle.records.find((record) => record.kind === 'handoff')?.id ?? 'missing']],
  ] as const)('rejects %s in an effect context', (_label, context) => {
    expectWriteProblem({ ...contextualWrite(), effectContext: [...context] });
  });

  it.each(['stagedContext', 'acknowledgedContext'] as const)(
    'validates every %s frame rather than trusting the effect context',
    (property) => {
      expectWriteProblem({ ...contextualWrite(), [property]: ['s2/add.notify'] });
    },
  );

  it('rejects an unresolved callee even when its implementation appears as a candidate', () => {
    expectWriteProblem(contextualWrite(), (record) =>
      record.id === 's2/resolve/http.add' && record.kind === 'resolution'
        ? { ...record, basis: 'unresolved', target: null, candidates: ['s2/add'] }
        : record,
    );
  });

  it('rejects a call frame after its resolution target changes to a sibling', () => {
    expectWriteProblem(contextualWrite(), (record) =>
      record.id === 's2/resolve/http.add' && record.kind === 'resolution'
        ? { ...record, target: 's2/notify' }
        : record,
    );
  });

  it('rejects an unresolved frame without source candidates too', () => {
    expectWriteProblem(contextualWrite(), (record) =>
      record.id === 's2/resolve/http.add' && record.kind === 'resolution'
        ? { ...record, basis: 'unresolved', target: null, candidates: [] }
        : record,
    );
  });

  it('rejects a resolution owned by a different implementation from its call', () => {
    expectWriteProblem(contextualWrite(), (record) =>
      record.id === 's2/resolve/http.add' && record.kind === 'resolution'
        ? { ...record, owner: 's2/add' }
        : record,
    );
  });

  it('rejects acknowledgement through a sibling call to the same implementation', () => {
    const call = bundle.records.find((record) => record.id === frame[0]);
    if (call?.kind !== 'operation') throw new Error('Missing invocation fixture');
    const replacement = {
      ...contextualWrite(),
      acknowledgedContext: ['review/http.add-again'],
    };
    const records = recordsFor(replacement);
    records.push({ ...call, id: 'review/http.add-again' });
    expect(checkKnowledge(parse.bundle({ ...bundle, records })).join('\n')).toContain(
      'effect and acknowledgement must identify the same invocation',
    );
  });

  it('rejects field values through an unrelated sibling call despite matching terminal owners', () => {
    const call = bundle.records.find((record) => record.id === frame[0]);
    if (call?.kind !== 'operation') throw new Error('Missing invocation fixture');
    const replacement = contextualWrite();
    replacement.fields = replacement.fields.map((field, index) =>
      index === 0 ? { ...field, context: ['review/http.add-again'] } : field,
    );
    const records = recordsFor(replacement);
    records.push({ ...call, id: 'review/http.add-again' });
    expect(checkKnowledge(parse.bundle({ ...bundle, records })).join('\n')).toContain(
      'write field context must belong to staging or effect lineage',
    );
  });

  it('allows a root field value alongside callee fields without inventing a child frame', () => {
    const replacement = contextualWrite();
    replacement.fields = replacement.fields.map((field, index) =>
      index === 0 ? { ...field, value: 's2/v/request', context: [] } : field,
    );
    expect(problems(replacement)).toEqual([]);
  });

  it('rejects a callee bound to a different runtime component', () => {
    const sourceHost = bundle.records.find((record) => record.id === 'u3/component/mas');
    if (sourceHost?.kind !== 'runtime_component') throw new Error('Missing host fixture');
    const records = recordsFor(contextualWrite(), (record) =>
      record.id === 'u3/runs/s2-add' && record.kind === 'execution_binding'
        ? { ...record, component: 'review/other-host' }
        : record,
    );
    records.push({
      ...sourceHost,
      id: 'review/other-host',
      logicalId: 'component:other-fixture-process',
      label: 'Other fixture process',
    });
    const errors = checkKnowledge(parse.bundle({ ...bundle, records }));
    expect(errors.some((problem) => problem.includes(write.id))).toBe(true);
  });

  it('retains invocation frames in supporting records and declared invalidation inputs', () => {
    const replacement = contextualWrite();
    const references = recordReferences(replacement);
    expect(references).toContain(frame[0]);
    const records = recordsFor(replacement);
    const derivation = {
      id: 'review/derive/storage-context',
      kind: 'derivation' as const,
      output: replacement.id,
      rule: 'Recompute the source write association when its declared invocation changes',
      inputs: references,
    };
    records.push(derivation);
    expect(checkKnowledge(parse.bundle({ ...bundle, records }))).toEqual([]);
    const reader = readerFor(records);
    const support = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, {
        query: 'records',
        ids: [replacement.id],
      }),
    );
    for (const id of [frame[0], 's2/resolve/http.add', 's2/add']) {
      expect(support.records.some((record) => record.id === id)).toBe(true);
    }
    const impact = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, {
        query: 'impact',
        changed: [...frame],
      }),
    );
    expect(impact.nodes.some((node) => node.record === replacement.id)).toBe(true);
    expect(impact.edges.some((edge) => edge.record === derivation.id)).toBe(true);
    expect(impact.records.some((record) => record.id === derivation.id)).toBe(true);
  });

  it('does not imply affected rows, atomic coordination or runtime success', () => {
    const contextual = contextualWrite();
    const reader = readerFor(recordsFor(contextual));
    const result = queryKnowledge(
      reader,
      runtimeRequest('soft-offer', reader.snapshot, { query: 'consistency' }),
    );
    expect(result.records.find((record) => record.id === write.id)).toMatchObject({
      acknowledgement: 'normal_return',
      atomicity: 'store_call_only',
      condition: write.condition,
    });
    expect(
      result.findings.some((finding) => finding.statement.includes('shared transaction')),
    ).toBe(true);
  });
});

describe('storage contexts retain the v2 boundary', () => {
  it.each(['effectContext', 'stagedContext', 'acknowledgedContext'] as const)(
    'rejects the new %s property even when empty in v2',
    (property) => {
      expect(() =>
        parse.bundle({
          ...legacy.bundle,
          records: legacy.bundle.records.map((record) =>
            record.id === write.id ? { ...record, [property]: [] } : record,
          ),
        }),
      ).toThrow(/must NOT have additional properties/u);
    },
  );

  it('rejects fields[].context even when empty in v2', () => {
    expect(() =>
      parse.bundle({
        ...legacy.bundle,
        records: legacy.bundle.records.map((record) =>
          record.id === write.id && record.kind === 'storage_write'
            ? { ...record, fields: record.fields.map((field) => ({ ...field, context: [] })) }
            : record,
        ),
      }),
    ).toThrow(/must NOT have additional properties/u);
  });
});
