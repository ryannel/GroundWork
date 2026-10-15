import { describe, expect, it } from 'vitest';

import {
  arrowHead,
  clipText,
  overlaps,
  roundPath,
  shortTopic,
  simplify,
  wrapText,
} from './plan-viz-flow-geometry';

describe('clipText', () => {
  it('leaves short text alone and ends a long one in an ellipsis', () => {
    expect(clipText('short', 10)).toBe('short');
    expect(clipText('a long sentence', 6)).toBe('a lon…');
  });
});

describe('shortTopic', () => {
  it('drops the environment and public prefix', () => {
    expect(shortTopic('<env>.public.orders')).toBe('orders');
    expect(shortTopic('<env>.orders')).toBe('orders');
    expect(shortTopic('orders')).toBe('orders');
    expect(shortTopic('<env>.public.')).toBe('<env>.public.');
  });
});

describe('wrapText', () => {
  it('wraps at the width', () => {
    expect(wrapText('look up the price for this product', 14, 3)).toEqual([
      'look up the',
      'price for this',
      'product',
    ]);
  });

  it('ends the last line in an ellipsis when there is more', () => {
    const lines = wrapText('one two three four five six seven eight', 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
  });

  it('is empty for no words', () => {
    expect(wrapText('   ', 10)).toEqual([]);
  });
});

describe('simplify', () => {
  it('drops repeated points and points in a straight line', () => {
    expect(
      simplify([
        [0, 0],
        [0, 0],
        [5, 0],
        [10, 0],
        [10, 10],
      ]),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });
});

describe('roundPath', () => {
  it('rounds the corners', () => {
    expect(
      roundPath([
        [0, 0],
        [20, 0],
        [20, 20],
      ]),
    ).toBe('M0 0 L12 0 Q20 0 20 8 L20 20');
  });

  it('keeps a corner square when the legs are too short to round', () => {
    expect(
      roundPath([
        [0, 0],
        [0, 0],
        [10, 0],
      ]),
    ).toBe('M0 0 L0 0 L10 0');
  });

  it('is empty without points', () => {
    expect(roundPath([])).toBe('');
  });
});

describe('overlaps', () => {
  it('meets, or misses, with the padding', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 12, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps(a, { x: 12, y: 0, w: 10, h: 10 }, 3)).toBe(true);
  });
});

describe('arrowHead', () => {
  it('points along the last leg', () => {
    expect(
      arrowHead([
        [0, 0],
        [10, 0],
      ]),
    ).toBe('M10 0 L2 4.5 L2 -4.5 Z');
  });

  it('is empty for a single point', () => {
    expect(arrowHead([[0, 0]])).toBe('');
  });
});
