import { describe, expect, it } from 'vitest';

import { allowancesOf, unexplained } from './allowances';
import { differences, serialise } from './snapshots';

describe('rebuild proof comparisons', () => {
  it('keeps array order, ignores object key order and escapes JSON pointers', () => {
    expect(differences('facts', { a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
    expect(
      serialise(
        new Map([
          ['b', 2],
          ['a', 1],
        ]),
      ),
    ).toBe(serialise({ a: 1, b: 2 }));
    expect(
      differences('facts', { 'a/b~': [1, 2] }, { 'a/b~': [2, 1] }).map((row) => row.path),
    ).toEqual(['/a~1b~0/0', '/a~1b~0/1']);
  });

  it('distinguishes missing data, null, removals and additions', () => {
    expect(differences('facts', { a: null }, {}).map((row) => row.path)).toEqual(['/a']);
    expect(differences('facts', [], [null])).toHaveLength(1);
    expect(differences('facts', { a: 1 }, { a: 2, b: 3 }).map((row) => row.path)).toEqual([
      '/a',
      '/b',
    ]);
  });

  it('requires the exact workspace, path and before/after values in every approval', () => {
    const changes = differences('facts', { a: 1 }, { a: 2 });
    const allowed = allowancesOf({
      format: 1,
      differences: changes.map((row) => ({
        ...row,
        workspace: 'acme',
        reason: 'Reviewed correction.',
      })),
    });
    expect(unexplained('acme', changes, allowed)).toEqual([]);
    expect(unexplained('personal', changes, allowed)).toHaveLength(1);
    expect(unexplained('acme', differences('facts', { a: 1 }, { a: 3 }), allowed)).toHaveLength(1);
    expect(() => allowancesOf({ format: 1, differences: [{ reason: '' }] })).toThrow(
      'needs workspace',
    );
    expect(() => allowancesOf({ format: 2 })).toThrow('Expected allowed-diffs');
  });
});
