import { describe, expect, it } from 'vitest';

import { layoutScreenFlow } from './plan-viz-screen-flow-layout';

const box = (id: string) => ({ id });
const line = (id: string, source: string, destination: string, shared = false) => ({
  id,
  source,
  destination,
  shared,
});

describe('layoutScreenFlow', () => {
  it('lays a straight path out one rank below the last', () => {
    const out = layoutScreenFlow(
      [box('a'), box('b'), box('c')],
      [line('1', 'a', 'b'), line('2', 'b', 'c')],
    );
    expect(out.nodes.map((n) => n.rank)).toEqual([0, 1, 2]);
    expect(out.nodes[0]?.y).toBeLessThan(out.nodes[2]?.y ?? 0);
    expect(out.edges.every((e) => !e.outside)).toBe(true);
    expect(out.edges.every((e) => e.points.length === 4)).toBe(true);
  });

  it('runs returns, shared controls and repeated controls round the outside', () => {
    const out = layoutScreenFlow(
      [box('a'), box('b'), box('c')],
      [
        line('1', 'a', 'b'),
        line('2', 'b', 'c'),
        line('3', 'c', 'a'),
        line('4', 'a', 'b'),
        line('5', 'a', 'c', true),
      ],
    );
    const outside = out.edges.filter((e) => e.outside).map((e) => e.id);
    expect(outside).toEqual(expect.arrayContaining(['3', '4', '5']));
    expect(out.width).toBeGreaterThan(188 + 24);
    for (const edge of out.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(4);
      expect(edge.label.w).toBeGreaterThan(0);
    }
  });

  it('keeps a screen reached by no recorded link apart, and ignores lines to unknown screens', () => {
    const out = layoutScreenFlow(
      [box('a'), box('b'), box('lonely')],
      [line('1', 'a', 'b'), line('x', 'a', 'ghost'), line('self', 'b', 'b')],
      { node: new Map([['a', { w: 100, h: 50 }]]), label: new Map([['1', { w: 40, h: 20 }]]) },
    );
    expect(out.nodes.find((n) => n.id === 'lonely')?.rank).toBe(2);
    expect(out.nodes.find((n) => n.id === 'a')?.w).toBe(100);
    expect(out.edges.map((e) => e.id)).not.toContain('x');
  });

  it('handles an empty map', () => {
    const out = layoutScreenFlow([], []);
    expect(out.nodes).toHaveLength(0);
    expect(out.edges).toHaveLength(0);
  });
});
