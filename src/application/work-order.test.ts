import { expect, it } from 'vitest';

import { workOrderOf } from './work-order';

it('keeps dependencies before consumers, then milestone and authored order, preserving exact records', () => {
  const dependent = {
    id: 'wi:last',
    milestone: 'ms:early',
    depends_on: ['wi:foundation'],
    title: 'The exact dependent row',
  };
  const foundation = { id: 'wi:foundation', milestone: 'ms:late', title: 'A required foundation' };
  const first = { id: 'wi:first', milestone: 'ms:early' };
  const second = { id: 'wi:second', milestone: 'ms:early' };
  const source = [dependent, foundation, first, second];
  const result = workOrderOf(source, [{ id: 'ms:early' }, { id: 'ms:late' }]);
  expect(result.map((item) => item.id)).toEqual([
    'wi:first',
    'wi:second',
    'wi:foundation',
    'wi:last',
  ]);
  expect(result[3]).toBe(dependent);
  expect(source).toEqual([dependent, foundation, first, second]);
});
it('retains unknown dependency and invalid-cycle records rather than dropping work', () => {
  const source = [
    { id: 'wi:a', depends_on: ['wi:b'] },
    { id: 'wi:b', depends_on: ['wi:a'] },
    { id: 'wi:outside', depends_on: ['wi:unknown'] },
  ];
  expect(workOrderOf(source, []).map((item) => item.id)).toEqual(['wi:outside', 'wi:a', 'wi:b']);
});
