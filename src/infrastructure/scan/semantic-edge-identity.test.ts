import { describe, expect, it, vi } from 'vitest';

import type { SemanticEdge } from '@/domain/scan/scan.generated';

import {
  createSemanticEdgeWriter,
  semanticEdge,
  type SemanticEdgeFields,
} from './semantic-edge-identity';

vi.mock(import('server-only'), () => ({}));

const EDGE: SemanticEdgeFields = {
  kind: 'semantic_edge',
  owner: 'summary:owner',
  source: 'source:origin',
  from: 'semantic:from',
  to: 'semantic:to',
  relation: 'argument',
  position: 0,
  label: 'arguments',
};
function emit(fields: readonly SemanticEdgeFields[]): readonly SemanticEdge[] {
  const result: SemanticEdge[] = [];
  const write = createSemanticEdgeWriter((edge) => {
    result.push(edge);
  });
  for (const field of fields) write(field);
  return result;
}

describe('semantic edge natural identities', () => {
  it('ignores object property order, prior IDs and unrelated emission order', () => {
    const ordered = semanticEdge(EDGE);
    const reversed: SemanticEdgeFields = {
      label: 'arguments',
      position: 0,
      relation: 'argument',
      to: 'semantic:to',
      from: 'semantic:from',
      source: 'source:origin',
      owner: 'summary:owner',
      kind: 'semantic_edge',
    };
    expect(semanticEdge(reversed).id).toBe(ordered.id);
    const legacy = { ...EDGE, id: 'legacy:sequence-73' };
    expect(semanticEdge(legacy).id).toBe(ordered.id);
    const other = { ...EDGE, to: 'semantic:other' };
    expect(emit([other, EDGE])[1]).toEqual(emit([EDGE, other])[0]);
    expect(emit([other, EDGE])[1]).toEqual(emit([EDGE])[0]);
  });
  it.each([
    { owner: 'summary:other' },
    { source: 'source:other' },
    { from: 'semantic:other' },
    { to: 'semantic:other' },
    { relation: 'receiver' },
    { position: 1 },
    { label: 'receiver' },
  ] satisfies readonly Partial<SemanticEdgeFields>[])(
    'changes identity for every changed semantic field: %j',
    (change) => {
      expect(semanticEdge({ ...EDGE, ...change }).id).not.toBe(semanticEdge(EDGE).id);
    },
  );
  it('distinguishes absent optional semantics from supplied values', () => {
    const { label, position, ...plain } = EDGE;
    expect(label).toBe('arguments');
    expect(position).toBe(0);
    expect(
      new Set([
        semanticEdge(plain).id,
        semanticEdge({ ...plain, position: 0 }).id,
        semanticEdge({ ...plain, label: '' }).id,
      ]).size,
    ).toBe(3);
  });
  it('hashes the whole semantic object, including future structured fields', () => {
    const first = { ...EDGE, extra: { later: [1, 'two'], earlier: true } };
    const reordered = { ...EDGE, extra: { earlier: true, later: [1, 'two'] } };
    const changed = { ...EDGE, extra: { earlier: true, later: ['two', 1] } };
    expect(semanticEdge(first).id).toBe(semanticEdge(reordered).id);
    expect(semanticEdge(first).id).not.toBe(semanticEdge(changed).id);
  });
  it('preserves distinct provenances and rejects an exact repeated fact explicitly', () => {
    expect(
      emit([EDGE, { ...EDGE, label: 'different source role' }, { ...EDGE, position: 1 }]),
    ).toHaveLength(3);
    expect(() => emit([EDGE, { ...EDGE }])).toThrow('Duplicate semantic edge fact');
  });
  it('rejects non-JSON numeric values instead of aliasing them with null', () => {
    expect(() => semanticEdge({ ...EDGE, position: Number.NaN })).toThrow('finite JSON numbers');
    expect(() => semanticEdge({ ...EDGE, position: Number.POSITIVE_INFINITY })).toThrow(
      'finite JSON numbers',
    );
  });
  it('sorts common-prefix and Unicode keys deterministically without locale collation', () => {
    const first = { ...EDGE, extra: { a: 1, aa: 2, é: 3, z: 4 } };
    const reversed = { ...EDGE, extra: { z: 4, é: 3, aa: 2, a: 1 } };
    expect(semanticEdge(first).id).toBe(semanticEdge(reversed).id);
  });
  it('rejects unsupported fields rather than omitting them from the identity', () => {
    const invalid = { ...EDGE, extra: Symbol('unserialisable') };
    expect(() => semanticEdge(invalid)).toThrow('requires JSON fields');
  });
  it('coalesces only exact compiler projection duplicates with an explicit diagnostic', () => {
    const records: SemanticEdge[] = [];
    const duplicates: SemanticEdge[] = [];
    const write = createSemanticEdgeWriter(
      (edge) => {
        records.push(edge);
      },
      {
        onExactDuplicate: (edge) => {
          duplicates.push(edge);
        },
      },
    );
    write(EDGE);
    write({ ...EDGE });
    write({ ...EDGE, label: 'another role' });
    expect(records).toHaveLength(2);
    expect(duplicates).toEqual([semanticEdge(EDGE)]);
    expect(records[1]?.label).toBe('another role');
  });
});
