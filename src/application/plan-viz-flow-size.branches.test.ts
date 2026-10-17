import { describe, expect, it } from 'vitest';

import { modelOf } from '@/../test/plan-kit';
import { acme } from '@/../test/workspace-kit';
import type { FlowStep } from '@/application/plan/flow-steps';
import type {
  FlowEdge,
  FlowGraph,
  FlowItem,
  FlowNodeSpec,
} from '@/application/plan-viz-flow-graph';
import { HEAD, labelEdges, ROW, sigOf, sizeNodes } from '@/application/plan-viz-flow-size';

const model = modelOf(acme().today.plan);

const step = (id: string): FlowStep => ({
  id,
  from: 'svc:shop-bff',
  to: 'svc:order-api',
  via: 'api:orders-create',
  action: 'place',
  $type: 'step',
  $path: [],
});

const item = (i: number, text: string, more: Partial<FlowItem> = {}): FlowItem => ({
  i,
  s: step(`flow:x#${String(i)}`),
  text,
  ...more,
});

const node = (at: Partial<FlowNodeSpec> & Pick<FlowNodeSpec, 'id' | 'kind'>): FlowNodeSpec => ({
  endpoints: [],
  selfs: [],
  events: [],
  sats: [],
  sat: false,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  fullH: 0,
  ph: 0,
  nameLines: [],
  ...at,
});

const edge = (at: Partial<FlowEdge> & Pick<FlowEdge, 'key' | 'from' | 'to'>): FlowEdge => ({
  kind: 'api',
  via: null,
  items: [],
  all: [],
  lines: [],
  lw: 0,
  lh: 0,
  back: false,
  ...at,
});

const graphOf = (
  nodes: readonly FlowNodeSpec[],
  edges: readonly FlowEdge[] = [],
  sats: readonly FlowEdge[] = [],
): FlowGraph => ({
  nodes: new Map(nodes.map((n) => [n.id, n])),
  edges: new Map(edges.map((e) => [e.key, e])),
  sats: new Map(sats.map((e) => [e.to, e])),
});

describe('sigOf', () => {
  it('reads an endpoint by its signature, and anything else by its name', () => {
    expect(sigOf(model, 'api:orders-create')).toBe('POST /orders');
    expect(sigOf(model, 'msg:order-placed')).toBe(model.label('msg:order-placed'));
  });
});

const sized = (n: FlowNodeSpec): FlowNodeSpec => {
  const got = sizeNodes(model, graphOf([n])).nodes.get(n.id);
  if (got === undefined) throw new Error('no node');
  return got;
};

describe('sizeNodes', () => {
  it('draws an empty card as its head alone', () => {
    expect(sized(node({ id: 'svc:order-api', kind: 'service' }))).toMatchObject({
      w: 212,
      h: HEAD,
    });
  });

  it('adds a row per endpoint and per own step, with room under them', () => {
    const card = sized(
      node({
        id: 'svc:order-api',
        kind: 'service',
        endpoints: [{ via: 'api:orders-create', steps: [0] }],
        selfs: [{ i: 1, s: step('flow:x#1'), lines: ['check', 'the stock'] }],
      }),
    );
    expect(card.w).toBe(212);
    expect(card.h).toBe(HEAD + ROW + (ROW + 14) + 8);
  });

  it('widens a card for a long signature, but no wider than 300', () => {
    const card = sized(
      node({
        id: 'svc:search-api',
        kind: 'service',
        endpoints: [{ via: 'api:search-query', steps: [0, 1, 2, 3, 4, 5, 6] }],
      }),
    );
    const want = Math.ceil(30 + 'GET /search?q={words}'.length * 6.6 + 7 * 17);
    expect(card.w).toBe(Math.min(300, Math.max(212, want)));
    const wide = sized(
      node({
        id: 'svc:search-api',
        kind: 'service',
        endpoints: [{ via: 'api:search-query', steps: Array.from({ length: 20 }, (_, k) => k) }],
      }),
    );
    expect(wide.w).toBe(300);
  });

  it('draws a topic as a pipe, taller for each event it carries', () => {
    const bare = sized(node({ id: 'st:order-events', kind: 'topic' }));
    const busy = sized(
      node({ id: 'st:order-events', kind: 'topic', events: ['msg:order-placed', 'msg:x'] }),
    );
    expect(bare.w).toBe(212);
    expect(bare.ph).toBe(bare.h);
    expect(bare.nameLines.length).toBeGreaterThan(0);
    expect(busy.h).toBe(bare.h + 8 + 2 * 16);
  });

  it('draws a store as a fixed cylinder', () => {
    expect(sized(node({ id: 'st:orders-db', kind: 'store' }))).toMatchObject({ w: 168, h: 62 });
  });
});

describe('labelEdges', () => {
  const ends = [
    node({ id: 'a', kind: 'service' }),
    node({ id: 'b', kind: 'service' }),
    node({ id: 's', kind: 'store' }),
  ];

  it('folds reads of the same records into one label, whatever order the refs come in', () => {
    const one = item(0, 'reads orders', { implicit: true, refs: ['sch:b', 'sch:a'] });
    const two = item(1, 'reads orders', { implicit: true, refs: ['sch:a', 'sch:b'] });
    const plain = item(2, 'place the order');
    const e = edge({
      key: 'k',
      from: 'a',
      to: 'b',
      items: [one, two, plain],
      all: [plain, two, one],
    });
    const out = labelEdges(model, graphOf(ends, [e]), {
      mode: 'toBe',
      rank: new Map([
        ['a', 0],
        ['b', 1],
      ]),
    });
    const labelled = out.edges.get('k');
    expect(labelled?.lines.map((l) => [l.t, l.first, l.it.members?.length])).toEqual([
      ['reads orders', true, 2],
      ['place the order', true, 1],
    ]);
    expect(labelled?.back).toBe(false);
    expect(labelled?.lh).toBe(2 * 15 + 4);
    expect(labelled?.lw).toBeCloseTo('place the order'.length * 6.3 + 22);
  });

  it('carries every step between the same two ends on the first arrow, and none on the rest', () => {
    const first = edge({ key: 'one', from: 'a', to: 'b', items: [item(3, 'second')] });
    const second = edge({ key: 'two', from: 'a', to: 'b', items: [item(1, 'first')] });
    const out = labelEdges(model, graphOf(ends, [first, second]), {
      mode: 'asIs',
      rank: new Map(),
    });
    expect(out.edges.get('one')?.lines.map((l) => l.t)).toEqual(['first', 'second']);
    expect(out.edges.get('two')).toMatchObject({ lines: [], lw: 0, lh: 0 });
  });

  it('marks a hop to the same or an earlier column as back, unless it goes to a satellite', () => {
    const back = edge({ key: 'back', from: 'b', to: 'a', items: [item(0, 'answer')] });
    const sat = edge({
      key: 'sat',
      from: 'b',
      to: 's',
      kind: 'data',
      items: [item(1, 'write it')],
    });
    const hung = node({
      id: 'b',
      kind: 'service',
      sats: [
        { id: 's', e: sat, r: { x: 0, y: 0, w: 0, h: 0 } },
        { id: 'gone', e: sat, r: { x: 0, y: 0, w: 0, h: 0 } },
      ],
    });
    const out = labelEdges(model, graphOf([ends[0] ?? hung, hung], [back], [sat]), {
      mode: 'toBe',
      rank: new Map([
        ['a', 0],
        ['b', 1],
      ]),
    });
    expect(out.edges.get('back')?.back).toBe(true);
    expect(out.sats.get('s')?.back).toBe(false);
    const sats = out.nodes.get('b')?.sats ?? [];
    expect(sats.map((x) => x.e.lines.map((l) => l.t))).toEqual([['write it'], []]);
  });

  it('wraps a long label onto two lines', () => {
    const words = 'look up the delivery promise for every line';
    const out = labelEdges(
      model,
      graphOf(ends, [
        edge({ key: 'k', from: 'a', to: 'b', items: [item(0, words, { fan: true })] }),
      ]),
      {
        mode: 'toBe',
        rank: new Map([
          ['a', 0],
          ['b', 1],
        ]),
      },
    );
    const lines = out.edges.get('k')?.lines ?? [];
    expect(lines.map((l) => l.first)).toEqual([true, false]);
  });
});
