import { describe, expect, it } from 'vitest';

import type { FlowStep } from '@/application/plan/flow-steps';
import type { Rect } from '@/application/plan-viz-flow-geometry';
import type { FlowEdge, FlowGraph, FlowNodeSpec } from '@/application/plan-viz-flow-graph';
import { routeEdges } from '@/application/plan-viz-flow-route';

const step: FlowStep = {
  id: 'f:1',
  from: 'svc:a',
  to: 'svc:b',
  via: 'ep:x',
  action: 'call',
  $type: 'step',
  $path: [],
};

type NodeAt = Partial<FlowNodeSpec> & Pick<FlowNodeSpec, 'id' | 'x' | 'y'>;

const node = (at: NodeAt): FlowNodeSpec => ({
  kind: 'service',
  endpoints: [],
  selfs: [],
  events: [],
  sats: [],
  sat: false,
  w: 100,
  h: 60,
  fullH: 60,
  ph: 0,
  nameLines: [],
  ...at,
});

type EdgeAt = Partial<FlowEdge> & Pick<FlowEdge, 'from' | 'to'>;

const edge = (at: EdgeAt, label = false): FlowEdge => ({
  key: `${at.from}>${at.to}`,
  kind: 'api',
  via: null,
  items: [],
  all: [],
  lines: label ? [{ t: 'call it', first: true, it: { i: 0, s: step, text: 'call it' } }] : [],
  lw: label ? 60 : 0,
  lh: label ? 19 : 0,
  back: false,
  ...at,
});

const graphOf = (
  nodes: readonly FlowNodeSpec[],
  edges: readonly FlowEdge[],
  sats: readonly FlowEdge[] = [],
): FlowGraph => ({
  nodes: new Map(nodes.map((n) => [n.id, n])),
  edges: new Map(edges.map((e) => [e.key, e])),
  sats: new Map(sats.map((e) => [e.to, e])),
});

const only = (graph: FlowGraph, height = 200) => {
  const { routed, h } = routeEdges(graph, height);
  const [first] = routed;
  if (first === undefined) throw new Error('no route');
  return { first, routed, h };
};

describe('routeEdges', () => {
  it('runs a forward arrow straight in when nothing is in the way', () => {
    const { first, h } = only(
      graphOf(
        [node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 300, y: 0 })],
        [edge({ from: 'a', to: 'b' })],
      ),
    );
    expect(first.pts).toEqual([
      [100, 23],
      [300, 23],
    ]);
    expect(first.r).toBeNull();
    expect(h).toBe(200);
  });

  it('enters at the endpoint row the arrow is for, and the middle of a pipe or store', () => {
    const card = node({
      id: 'b',
      x: 300,
      y: 0,
      endpoints: [
        { via: 'ep:one', steps: [] },
        { via: 'ep:two', steps: [] },
      ],
    });
    const pipe = node({ id: 't', x: 300, y: 300, kind: 'topic', ph: 40 });
    const store = node({ id: 's', x: 300, y: 600, kind: 'store' });
    const { routed } = routeEdges(
      graphOf(
        [node({ id: 'a', x: 0, y: 0 }), card, pipe, store],
        [
          edge({ key: 'a1', from: 'a', to: 'b', via: 'ep:two' }),
          edge({ key: 'a2', from: 'a', to: 'b', via: 'ep:missing' }),
          edge({ key: 'a3', from: 'a', to: 't' }),
          edge({ key: 'a4', from: 'a', to: 's' }),
        ],
      ),
      900,
    );
    expect(routed.map((r) => r.pts.at(-1))).toEqual([
      [300, 46 + 22 + 11],
      [300, 23],
      [300, 320],
      [300, 600 + 7 + 55 / 2],
    ]);
  });

  it('turns along the source row when the target row is blocked', () => {
    const { first } = only(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'b', x: 300, y: 200 }),
          node({ id: 'c', x: 200, y: 190, w: 50 }),
        ],
        [edge({ from: 'a', to: 'b' })],
      ),
      400,
    );
    expect(first.pts).toEqual([
      [100, 23],
      [282, 23],
      [282, 223],
      [300, 223],
    ]);
  });

  it('drops into a lane under the drawing when both rows are blocked, and grows the drawing', () => {
    const { first, h } = only(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'b', x: 300, y: 0 }),
          node({ id: 'c', x: 150, y: -10, w: 50, h: 80, fullH: 80 }),
        ],
        [edge({ from: 'a', to: 'b' })],
      ),
      100,
    );
    const lane = 100 - 24 + 12;
    expect(first.pts).toEqual([
      [100, 23],
      [118, 23],
      [118, lane],
      [282, lane],
      [282, 23],
      [300, 23],
    ]);
    expect(h).toBe(lane + 16 + 8);
  });

  it('loops a hop back under the source and the cards beside it, and a second hop from the same source takes the next lane', () => {
    const { routed } = routeEdges(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'b', x: 300, y: 0 }),
          node({ id: 'c', x: 150, y: 40, w: 50 }),
        ],
        [
          edge({ key: 'back1', from: 'b', to: 'a', back: true }, true),
          edge({ key: 'back2', from: 'b', to: 'c', back: true }),
        ],
      ),
      300,
    );
    const [one, two] = routed;
    const y = 40 + 60 + 14;
    expect(one?.pts).toEqual([
      [400, 23],
      [418, 23],
      [418, y],
      [-18, y],
      [-18, 23],
      [0, 23],
    ]);
    expect(one?.r?.y).toBe(y + 6);
    const next = y + 16 + 19;
    expect(two?.pts[2]).toEqual([418, next]);
  });

  it('gives parallel arrows from different sources their own trunks, and reuses a source trunk', () => {
    const { routed } = routeEdges(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'z', x: 0, y: 400 }),
          node({ id: 'b', x: 300, y: 200 }),
          node({ id: 'c', x: 300, y: 600 }),
        ],
        [edge({ from: 'a', to: 'b' }), edge({ from: 'z', to: 'b' }), edge({ from: 'a', to: 'c' })],
      ),
      900,
    );
    expect(routed.map((r) => r.pts[1]?.[0])).toEqual([118, 124, 118]);
  });

  it('skips arrows whose ends are not drawn', () => {
    const { routed } = routeEdges(
      graphOf([node({ id: 'a', x: 0, y: 0 })], [edge({ from: 'a', to: 'gone' })]),
      100,
    );
    expect(routed).toEqual([]);
  });

  it('puts a label above the line, and grows the drawing to fit one near the bottom', () => {
    const { first, h } = only(
      graphOf(
        [node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 300, y: 0 })],
        [edge({ from: 'a', to: 'b' }, true)],
      ),
      10,
    );
    expect(first.r).toEqual({ x: 179, y: 0, w: 60, h: 19 });
    expect(h).toBe(19 + 24);
  });

  it('moves a label under the line when above it would sit on a card', () => {
    const { first } = only(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'b', x: 300, y: 100 }),
          node({ id: 'c', x: 150, y: 60, w: 100, h: 40, fullH: 40 }),
        ],
        [edge({ from: 'a', to: 'b' }, true)],
      ),
      400,
    );
    expect(first.r?.y).toBe(123 + 6);
  });

  it('keeps a label above when below would clash too', () => {
    const { first } = only(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'b', x: 300, y: 100 }),
          node({ id: 'c', x: 150, y: 60, w: 100, h: 40, fullH: 40 }),
          node({ id: 'd', x: 150, y: 128, w: 100, h: 40, fullH: 40 }),
        ],
        [edge({ from: 'a', to: 'b' }, true)],
      ),
      400,
    );
    expect(first.r?.y).toBe(123 - 19 - 4);
  });

  it('moves a label off another label, and off another source arrow', () => {
    const { routed } = routeEdges(
      graphOf(
        [
          node({ id: 'a', x: 0, y: 0 }),
          node({ id: 'z', x: 0, y: 2 }),
          node({ id: 'b', x: 300, y: 0 }),
        ],
        [
          edge({ key: 'one', from: 'a', to: 'b' }, true),
          edge({ key: 'two', from: 'z', to: 'b' }, true),
        ],
      ),
      400,
    );
    const [one, two] = routed;
    expect(one?.r?.y).toBe(0);
    expect(two?.r?.y).toBe(23 + 6);
  });

  it('hangs a satellite store under its service on a short trunk, and leaves out one not drawn', () => {
    const sat: Rect = { x: 20, y: 90, w: 40, h: 10 };
    const toStore = edge({ key: 's', from: 'a', to: 's', kind: 'data' });
    const toGone = edge({ key: 'g', from: 'a', to: 'gone', kind: 'data' });
    const a = node({
      id: 'a',
      x: 0,
      y: 0,
      sats: [
        { id: 's', e: toStore, r: sat },
        { id: 'gone', e: toGone, r: sat },
      ],
    });
    const store = node({ id: 's', x: 40, y: 120, kind: 'store', sat: true });
    const { routed } = routeEdges(graphOf([a, store], [], [toStore, toGone]), 300);
    expect(routed).toEqual([
      {
        e: toStore,
        pts: [
          [16, 60],
          [16, 120 + 7 + 55 / 2],
          [40, 120 + 7 + 55 / 2],
        ],
        r: sat,
        sat: true,
      },
    ]);
  });
});
