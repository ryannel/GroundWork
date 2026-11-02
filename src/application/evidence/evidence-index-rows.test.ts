import { describe, expect, it } from 'vitest';

import { citedLines, indexedRecord, recordLabel, recordLinks } from './evidence-index-rows';
import { limitOf, matchExpression } from './evidence-query';

const sources = citedLines([
  { kind: 'source', id: 'source:1', path: 'Api/SettingsController.cs', lines: [10, 24] },
]);

describe('evidence index rows', () => {
  it('labels a route by its methods and template', () => {
    const route = { kind: 'route', id: 'r', httpMethods: ['GET'], template: 'v1/settings' };
    expect(recordLabel(route)).toBe('GET /v1/settings');
  });

  it('labels other records by the first naming field they have, else their id', () => {
    expect(recordLabel({ kind: 'binding', id: 'b', symbol: 'Settings.Get()' })).toBe(
      'Settings.Get()',
    );
    expect(recordLabel({ kind: 'contract', id: 'c', shape: { name: 'string' } })).toBe('string');
    expect(recordLabel({ kind: 'x', id: 'x:1' })).toBe('x:1');
    expect(recordLabel({ kind: 'x', id: 'x', statement: 'a'.repeat(300) })).toHaveLength(160);
  });

  it('places a record at the file and lines its source cites', () => {
    const row = indexedRecord('framework', { kind: 'route', id: 'r', source: 'source:1' }, sources);
    expect(row).toMatchObject({ path: 'Api/SettingsController.cs', lineStart: 10, lineEnd: 24 });
    expect(
      indexedRecord('claims', { kind: 'purpose', id: 'c', statement: 'Why' }, sources),
    ).toMatchObject({
      path: null,
      text: 'Why',
    });
  });

  it('links a record to the known ids it names, at any depth', () => {
    const record = {
      kind: 'summary',
      id: 'summary:1',
      source: 'source:1',
      operations: [{ id: 'operation:1', source: 'source:2', target: { gap: 'gap:1' } }],
    };
    const known = new Set(['source:1', 'source:2', 'gap:1', 'summary:1']);
    expect(recordLinks(record, known)).toEqual([
      { from: 'summary:1', field: 'source', to: 'source:1' },
      { from: 'summary:1', field: 'operations', to: 'gap:1' },
      { from: 'summary:1', field: 'operations', to: 'source:2' },
    ]);
  });
});

describe('evidence query helpers', () => {
  it('quotes each word as a prefix match, so search text cannot inject syntax', () => {
    expect(matchExpression('Settings "OR" get*')).toBe('"Settings"* "OR"* "get"*');
    expect(matchExpression('  ')).toBeNull();
  });

  it('bounds a page size', () => {
    expect([limitOf(), limitOf(0), limitOf(5000)]).toEqual([100, 1, 1000]);
  });
});
