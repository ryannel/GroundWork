import { describe, expect, it } from 'vitest';

import { type Context, serviceBox } from '@/application/plan-viz-system-map-boxes';
import { aggregate } from '@/application/plan-viz-system-map-links';
import type { Merged } from '@/application/plan-viz-system-map-routes';
import {
  type MapNodeIn,
  SHOW_ALL,
  type SystemMapInput,
} from '@/application/plan-viz-system-map-types';

import {
  cardTip,
  carried,
  innerText,
  lineTip,
  pairTip,
  rowTip,
  systemTip,
} from './plan-viz-system-map-tips';

function context(options: Partial<SystemMapInput> = {}): Context {
  const nodes: MapNodeIn[] = [
    {
      id: 'svc:shop',
      name: 'Shop',
      kind: 'ui',
      does: 'Shows products',
      team: 'team:web',
      teamSlot: 1,
    },
    { id: 'svc:products', name: 'Products', kind: 'service', does: '', team: null, teamSlot: 2 },
    {
      id: 'sys:shop',
      name: 'Commerce',
      kind: 'system',
      does: 'Sells products',
      team: 'team:web',
      teamSlot: 1,
    },
    {
      id: 'st:db',
      name: 'Database',
      kind: 'database',
      does: 'Keeps orders',
      team: null,
      teamSlot: 1,
    },
  ];
  const input: SystemMapInput = {
    services: [],
    systems: [],
    stores: [],
    edges: [],
    steps: [],
    stages: [],
    stageOf: {},
    refs: {},
    interfaceOf: {},
    lens: null,
    focus: null,
    labels: {
      ...Object.fromEntries(nodes.map((node) => [node.id, node.name])),
      'sys:products': 'Catalogue',
      'team:web': 'Web',
      'if:products': 'Products API',
      'api:a': 'Read product',
      'api:b': 'Find product',
      'msg:c': 'Changed',
      'flow:buy': 'Buy',
    },
    ...options,
  };
  return {
    input,
    agg: aggregate(input, SHOW_ALL),
    show: SHOW_ALL,
    nodes: new Map(nodes.map((node) => [node.id, node])),
    label: (id) => input.labels[id] ?? id,
  };
}
const box = (ctx: Context, id = 'svc:shop') => serviceBox(ctx, id, { x: 0, y: 0, w: 184, col: 0 });
const line = (overrides: Partial<Merged> = {}): Merged => ({
  key: 'call',
  kind: 'api',
  a: 'svc:shop',
  b: 'svc:products',
  shownA: 'sys:shop',
  shownB: 'sys:products',
  hostA: 'svc:shop',
  hostB: 'svc:products',
  row: null,
  kinds: new Set(['api']),
  vias: new Set(),
  flows: new Set(),
  parts: new Set(['one']),
  read: false,
  write: false,
  noted: false,
  ...overrides,
});

describe('map card descriptions', () => {
  it('shows kinds, recorded purpose and ownership without inventing missing descriptions', () => {
    const ctx = context();
    expect(cardTip(ctx, box(ctx))).toBe('Shop (ui) · Web\nShows products');
    expect(cardTip(ctx, { ...box(ctx), sys: 'sys:shop' })).toBe(
      'Shop (ui) · part of Commerce\nShows products',
    );
    expect(cardTip(ctx, box(ctx, 'svc:products'))).toBe('Products');
    expect(cardTip(ctx, { ...box(ctx), kind: 'topic' })).toBe('Topic: Shop\nShows products');
    expect(cardTip(ctx, { ...box(ctx, 'st:db'), kind: 'store' })).toBe(
      'Database: Database\nKeeps orders',
    );
    expect(cardTip(ctx, { ...box(ctx, 'missing'), kind: 'store' })).toBe('Store: missing');
    expect(cardTip(ctx, box(ctx, 'missing'))).toBe('missing');
    expect(cardTip(ctx, { ...box(ctx), compact: true })).toBe(
      'Shop (ui) · Web\nShows products\nNo calls, events or stores modelled today',
    );
  });
  it('describes system parts and limits inside lines with the exact remaining count', () => {
    const ctx = context();
    const frame = { ...box(ctx, 'sys:shop'), parts: ['svc:shop', 'svc:products'] };
    expect(systemTip(ctx, frame, [])).toBe(
      'Commerce (system · Web)\nSells products\nParts: Shop, Products',
    );
    expect(systemTip(ctx, { ...box(ctx, 'missing'), parts: [] }, ['one'])).toBe(
      'missing (system)\nParts: \nInside:\none',
    );
    expect(systemTip(ctx, frame, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])).toBe(
      'Commerce (system · Web)\nSells products\nParts: Shop, Products\nInside:\n1\n2\n3\n4\n5\n6\n7\n8\n+2 more',
    );
  });
  it.each([
    [0, 'called today'],
    [1, '1 endpoint called today'],
    [3, '3 endpoints called today'],
  ])('counts %s called endpoints', (count, text) => {
    expect(rowTip('Products API', count)).toBe(`Products API: ${text}`);
  });
});

describe('map connection descriptions', () => {
  it.each([
    ['api', false, false, 'Shop calls Products'],
    ['msg', false, false, 'Shop → Products'],
    ['data', true, false, 'Shop reads Products'],
    ['data', false, true, 'Shop writes Products'],
    ['data', true, true, 'Shop reads and writes Products'],
  ] as const)('explains %s read=%s write=%s', (kind, read, write, expected) => {
    expect(
      innerText(context(), {
        a: 'svc:shop',
        b: 'svc:products',
        hostA: 'svc:shop',
        hostB: 'svc:products',
        kind,
        read,
        write,
      }),
    ).toBe(expected);
    expect(lineTip(context(), line({ kind, read, write }))).toBe(expected);
  });
  it('keeps interface, transport, carried calls, flows and stage-only qualification', () => {
    const ctx = context({ callWords: { 'api:a': 'GraphQL query', 'api:b': 'GraphQL query' } });
    const value = line({
      row: 'if:products',
      vias: new Set(['api:a', 'api:b']),
      flows: new Set(['flow:buy']),
      noted: true,
    });
    expect(lineTip(ctx, value)).toBe(
      'Shop calls Products API on Products by GraphQL query\nRead product\nFind product\nIn: Buy\nShown on its stage; no flow uses it yet.',
    );
    expect(lineTip(ctx, { ...value, parts: new Set(['one', 'two']) })).toBe(
      'Commerce calls Products API on Catalogue by GraphQL query\nRead product\nFind product\nIn: Buy\nShown on its stage; no flow uses it yet.',
    );
    expect(
      lineTip(
        context(),
        line({ kind: 'msg', vias: new Set(['msg:c']), flows: new Set(['flow:buy']), noted: true }),
      ),
    ).toBe('Shop → Products: Changed\nIn: Buy\nShown on its stage; no flow uses it yet.');
  });
  it('reports a common transport only when every call has the same known transport', () => {
    const value = line({ vias: new Set(['api:a', 'api:b']) });
    expect(lineTip(context({ callWords: { 'api:a': 'REST call' } }), value)).toBe(
      'Shop calls Products\nRead product\nFind product',
    );
    expect(
      lineTip(context({ callWords: { 'api:a': 'REST call', 'api:b': 'GraphQL query' } }), value),
    ).toBe('Shop calls Products\nRead product\nFind product');
  });
  it('groups carried data by frequency then name, distinguishing events from calls', () => {
    const ctx = context({
      carries: {
        'api:a': 'Product',
        'api:b': 'Product',
        'msg:c': 'Price changed',
        'api:d': 'Alpha',
        'api:e': 'Beta',
      },
      callWords: { 'api:a': 'REST call', 'api:b': 'REST call' },
    });
    expect(carried(ctx, line({ vias: new Set(['api:e', 'api:a', 'api:d', 'api:b']) }))).toEqual([
      ['Product', 2],
      ['Alpha', 1],
      ['Beta', 1],
    ]);
    expect(carried(ctx, line({ vias: new Set(['unrecorded']) }))).toEqual([['unrecorded', 1]]);
    expect(pairTip(ctx, line({ vias: new Set(['api:a', 'api:b', 'msg:c']) }))).toBe(
      'Commerce gets data from Catalogue\nProduct · 2 calls\nPrice changed · event',
    );
    expect(pairTip(ctx, line({ vias: new Set(['api:a']) }))).toBe(
      'Commerce gets data from Catalogue by REST call\nProduct · call',
    );
    expect(
      pairTip(
        ctx,
        line({
          kinds: new Set(['msg']),
          kind: 'msg',
          vias: new Set(['msg:c']),
          flows: new Set(['flow:buy']),
          noted: true,
        }),
      ),
    ).toBe(
      'Commerce listens to Catalogue\nPrice changed · event\nIn: Buy\nShown on its stage; no flow uses it yet.',
    );
    expect(pairTip(ctx, line({ kinds: new Set(['data']), kind: 'data', write: true }))).toBe(
      'Commerce writes Catalogue',
    );
  });
  it('limits long lists of calls and carried data and gives the exact remainder', () => {
    const ctx = context();
    const vias = Array.from({ length: 10 }, (_, index) => `api:${String(index)}`);
    expect(lineTip(ctx, line({ vias: new Set(vias) }))).toBe(
      'Shop calls Products\napi:0\napi:1\napi:2\napi:3\napi:4\napi:5\n+4 more',
    );
    expect(pairTip(ctx, line({ vias: new Set(vias) }))).toBe(
      'Commerce gets data from Catalogue\napi:0 · call\napi:1 · call\napi:2 · call\napi:3 · call\napi:4 · call\napi:5 · call\napi:6 · call\napi:7 · call\n+2 more',
    );
  });
});
