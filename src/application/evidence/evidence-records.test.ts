import { describe, expect, it } from 'vitest';

import { evidenceMerge, mergeDocuments, splitEvidence, storedRecord } from './evidence-records';

const source = (id: string, path = 'Api/Controller.cs') => ({
  kind: 'source',
  id,
  repo: 'acme/api',
  commit: 'abc',
  path,
  lines: [1, 2],
});

describe('evidence records', () => {
  it('keeps the first document’s record for an id', () => {
    const merged = mergeDocuments([
      { framework: [{ kind: 'route', id: 'route:1', template: 'first' }] },
      { framework: [{ kind: 'route', id: 'route:1', template: 'second' }], format: 'scan/v1' },
    ]);
    expect([...(merged.get('framework')?.values() ?? [])]).toEqual([
      { kind: 'route', id: 'route:1', template: 'first' },
    ]);
  });

  it('hands back each syntax record once, without holding it', () => {
    const merge = evidenceMerge();
    const node = { kind: 'node', id: 'node:1', repo: 'acme/api', owner: 'x' };
    expect(merge.add({ semantic: [node] })).toEqual([{ kind: 'node', id: 'node:1', owner: 'x' }]);
    expect(merge.add({ semantic: [node] })).toEqual([]);
    expect(merge.merged.has('semantic')).toBe(false);
  });

  it('drops the shared repository, commit and code text from a stored record', () => {
    const record = { kind: 'node', id: 'n', repo: 'r', commit: 'c', syntax: {}, name: 'x\ny' };
    expect(storedRecord(record)).toEqual({ kind: 'node', id: 'n' });
    expect(storedRecord({ kind: 'node', id: 'n', name: 'Get' })).toEqual({
      kind: 'node',
      id: 'n',
      name: 'Get',
    });
  });

  it('keeps facts and the spans they cite as evidence, call-level analysis and the rest for the caches', () => {
    const split = splitEvidence(
      mergeDocuments([
        {
          sources: [source('source:b'), source('source:a'), source('source:c'), source('source:z')],
          framework: [{ kind: 'route', id: 'route:1', support: ['source:b', 'source:a'] }],
          bindings: [{ kind: 'binding', id: 'binding:1', source: 'source:c' }],
          receipts: [{ kind: 'receipt', id: 'receipt:1', source: 'source:z' }],
        },
      ]),
    );
    expect(split.evidence.get('sources')?.map((record) => record.id)).toEqual([
      'source:a',
      'source:b',
    ]);
    expect(split.evidence.has('receipts' as never)).toBe(false);
    expect(split.evidence.has('bindings')).toBe(false);
    expect(
      [...split.analysis].map(([family, records]) => [family, records.map((record) => record.id)]),
    ).toEqual([
      ['bindings', ['binding:1']],
      ['sources', ['source:c']],
    ]);
    expect(split.syntaxSources.map((record) => record.id)).toEqual(['source:z']);
    expect(split.evidence.get('sources')?.[0]).not.toHaveProperty('repo');
  });

  it('refuses a family it does not know, rather than silently dropping facts', () => {
    expect(() => splitEvidence(mergeDocuments([{ novel: [{ kind: 'x', id: 'x:1' }] }]))).toThrow(
      'Unknown scan record family: novel',
    );
  });
});
