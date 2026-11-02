import { describe, expect, it } from 'vitest';

import { crossings, orderColumns } from './column-order';

const node = (id: string) => ({ id });

describe('column order', () => {
  it('untangles crossing lines between neighbouring columns', () => {
    const columns = [
      [node('a'), node('b'), node('c')],
      [node('z'), node('y'), node('x')],
    ];
    const links = [
      { from: 'a', to: 'x' },
      { from: 'b', to: 'y' },
      { from: 'c', to: 'z' },
    ];

    expect(crossings(columns, links)).toBe(3);
    const ordered = orderColumns(columns, links);
    expect(crossings(ordered, links)).toBe(0);
    expect(ordered[1]?.map((item) => item.id)).toEqual(['x', 'y', 'z']);
  });

  it('keeps the given order when nothing crosses', () => {
    const columns = [[node('a'), node('b')], [node('c')]];
    expect(orderColumns(columns, [{ from: 'a', to: 'c' }])).toBe(columns);
  });
});
