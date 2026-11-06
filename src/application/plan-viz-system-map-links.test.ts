import { describe, expect, it } from 'vitest';

import {
  type MapEdgeIn,
  type MapRefIn,
  type MapSatelliteIn,
  SHOW_ALL,
  type SystemMapInput,
} from '@/application/plan-viz-system-map-types';

import { aggregate } from './plan-viz-system-map-links';

function input(extra: Partial<SystemMapInput> = {}): SystemMapInput {
  return {
    services: ['a', 'b', 'c'].map((id) => ({
      id: `svc:${id}`,
      name: id,
      kind: 'service',
      does: '',
      team: null,
      teamSlot: 0,
      system: null,
    })),
    systems: [],
    stores: [],
    edges: [],
    steps: [],
    stages: [],
    stageOf: {},
    refs: {},
    interfaceOf: {},
    labels: {},
    lens: null,
    focus: null,
    ...extra,
  };
}
const edge = (from: string, to: string, extra: Partial<MapEdgeIn> = {}): MapEdgeIn => ({
  kind: 'api',
  from,
  to,
  via: null,
  steps: [],
  read: false,
  write: false,
  ...extra,
});
const store = (id = 'st:db', extra: Partial<MapSatelliteIn> = {}): MapSatelliteIn => ({
  id,
  name: id,
  kind: 'database',
  does: '',
  team: null,
  teamSlot: 0,
  topic: false,
  owner: 'svc:b',
  carries: [],
  ...extra,
});
const ref = (type: string, extra: Partial<MapRefIn> = {}): MapRefIn => ({
  type,
  service: null,
  parent: null,
  topic: false,
  ...extra,
});

describe('map connection aggregation', () => {
  it('merges calls on the same interface but preserves their endpoints, flows and row count', () => {
    const result = aggregate(
      input({
        interfaceOf: { 'api:get': 'if:b', 'api:put': 'if:b' },
        edges: [
          edge('svc:a', 'svc:b', { via: 'api:get', steps: ['flow:read#one', 'flow:read#two'] }),
          edge('svc:a', 'svc:b', { via: 'api:put', steps: ['flow:update#one'] }),
        ],
      }),
      SHOW_ALL,
    );
    expect(result.links).toEqual([
      {
        key: 'api|svc:a|svc:b|if:b',
        kind: 'api',
        a: 'svc:a',
        b: 'svc:b',
        row: 'if:b',
        vias: new Set(['api:get', 'api:put']),
        flows: new Set(['flow:read', 'flow:update']),
        flags: new Set(['walked']),
      },
    ]);
    expect(result.rowsOf.get('svc:b')?.get('if:b')).toEqual({
      id: 'if:b',
      eps: new Set(['api:get', 'api:put']),
      n: 2,
    });
    expect(result.kinds.get('svc:a')).toEqual(new Set(['api']));
    expect(result.kinds.get('svc:b')).toEqual(new Set(['api']));
    expect(result.kinds.get('svc:c')).toEqual(new Set());
  });
  it('keeps separate interfaces distinct and omits calls to unknown components', () => {
    const result = aggregate(
      input({
        edges: [
          edge('svc:a', 'svc:b', { via: 'api:one' }),
          edge('svc:a', 'svc:b', { via: 'api:two' }),
          edge('svc:a', 'missing'),
          edge('missing', 'svc:a'),
          edge('svc:a', 'svc:a'),
        ],
      }),
      SHOW_ALL,
    );
    expect(result.links.map(({ row, vias }) => ({ row, vias }))).toEqual([
      { row: 'api:one', vias: new Set(['api:one']) },
      { row: 'api:two', vias: new Set(['api:two']) },
    ]);
    expect(aggregate(input({ edges: [edge('svc:a', 'svc:b')] }), SHOW_ALL).links[0]?.vias).toEqual(
      new Set(),
    );
    expect(
      aggregate(input({ edges: [edge('svc:a', 'svc:b')] }), SHOW_ALL)
        .rowsOf.get('svc:b')
        ?.get(''),
    ).toEqual({ id: '', eps: new Set(), n: 1 });
  });
  it('uses explicit owners first, then a recorded incoming or outgoing use, leaving unused stores unplaced', () => {
    const result = aggregate(
      input({
        stores: [
          store(),
          store('st:incoming', { owner: 'missing' }),
          store('st:outgoing', { owner: null }),
          store('st:unused', { owner: null }),
        ],
        edges: [edge('svc:a', 'st:db'), edge('svc:c', 'st:incoming'), edge('st:outgoing', 'svc:a')],
      }),
      SHOW_ALL,
    );
    expect([...result.hostOfSat]).toEqual([
      ['st:db', 'svc:b'],
      ['st:incoming', 'svc:c'],
      ['st:outgoing', 'svc:a'],
    ]);
    expect(result.isTopic('st:db')).toBe(false);
    expect(result.isTopic('missing')).toBe(false);
  });
  it('preserves read and write flags while merging data uses and omits owner-internal or unplaced access', () => {
    const result = aggregate(
      input({
        stores: [store()],
        edges: [
          edge('svc:a', 'st:db', { kind: 'data', read: true, steps: ['flow:read#one'] }),
          edge('svc:a', 'st:db', { kind: 'data', write: true, steps: ['flow:write#one'] }),
          edge('svc:b', 'st:db', { kind: 'data', read: true }),
          edge('missing', 'st:db', { kind: 'data' }),
          edge('svc:a', 'st:missing', { kind: 'data' }),
        ],
      }),
      SHOW_ALL,
    );
    expect(result.links).toEqual([
      {
        key: 'data|svc:a|st:db|',
        kind: 'data',
        a: 'svc:a',
        b: 'st:db',
        row: null,
        vias: new Set(),
        flows: new Set(['flow:read', 'flow:write']),
        flags: new Set(['walked', 'read', 'write']),
      },
    ]);
    expect(result.kinds.get('svc:b')).toEqual(new Set(['data']));
    const folded = aggregate(
      input({ stores: [store()], edges: [edge('svc:a', 'st:db', { kind: 'data', read: true })] }),
      { ...SHOW_ALL, stores: false },
    );
    expect(folded.links[0]).toMatchObject({
      a: 'svc:a',
      b: 'svc:b',
      vias: new Set(['st:db']),
      flags: new Set(['walked', 'read']),
    });
  });
  it('keeps cross-component event delivery and folds hidden topics onto their recorded host', () => {
    const value = input({
      stores: [store('st:topic', { topic: true })],
      edges: [
        edge('svc:a', 'st:topic', { kind: 'msg', via: 'msg:published' }),
        edge('st:topic', 'svc:c', { kind: 'msg', via: 'msg:published' }),
        edge('svc:b', 'st:topic', { kind: 'msg' }),
        edge('svc:a', 'svc:c', { kind: 'msg', via: 'msg:direct' }),
        edge('missing', 'st:topic', { kind: 'msg' }),
      ],
    });
    const shown = aggregate(value, SHOW_ALL);
    expect(shown.isTopic('st:topic')).toBe(true);
    expect(shown.links.map(({ a, b, vias }) => ({ a, b, vias }))).toEqual([
      { a: 'svc:a', b: 'st:topic', vias: new Set(['msg:published']) },
      { a: 'st:topic', b: 'svc:c', vias: new Set(['msg:published']) },
      { a: 'svc:a', b: 'svc:c', vias: new Set(['msg:direct']) },
    ]);
    const hidden = aggregate(value, { ...SHOW_ALL, topics: false });
    expect(hidden.links.map(({ a, b }) => [a, b])).toEqual([
      ['svc:a', 'svc:b'],
      ['svc:b', 'svc:c'],
      ['svc:a', 'svc:c'],
    ]);
    expect(shown.kinds.get('svc:b')).toEqual(new Set(['msg']));
  });
  it('includes an unmodelled cross-component call once and does not turn API or message steps into extra calls', () => {
    const steps = ['internal', 'lib:helper', 'api:get', 'msg:event'].map((via, index) => ({
      id: `flow:work#${String(index)}`,
      from: 'svc:a',
      to: 'svc:b',
      via,
    }));
    const result = aggregate(
      input({
        steps: [
          ...steps,
          { id: 'flow:work#self', from: 'svc:a', to: 'svc:a', via: '' },
          { id: 'flow:work#missing', from: 'missing', to: 'svc:b', via: '' },
        ],
      }),
      SHOW_ALL,
    );
    expect(result.links).toEqual([
      {
        key: 'api|svc:a|svc:b|',
        kind: 'api',
        a: 'svc:a',
        b: 'svc:b',
        row: null,
        vias: new Set(),
        flows: new Set(['flow:work']),
        flags: new Set(['walked']),
      },
    ]);
  });
  it('keeps stage-only service, interface, endpoint, store and event links explicitly marked as authored', () => {
    const value = input({
      stores: [store(), store('st:topic', { topic: true })],
      refs: {
        'svc:b': ref('service'),
        'if:b': ref('interface', { service: 'svc:b' }),
        'api:get': ref('endpoint', { parent: 'if:b' }),
        'st:db': ref('store'),
        'st:topic': ref('store', { topic: true }),
      },
      stages: [
        {
          id: 'stage:read',
          name: 'Read',
          summary: '',
          entries: [
            {
              svc: 'svc:a',
              reads: ['svc:b', 'if:b', 'api:get', 'st:db', 'st:topic', 'missing', 'svc:a'],
            },
            { svc: 'missing', reads: ['svc:b'] },
          ],
        },
      ],
    });
    const result = aggregate(value, SHOW_ALL);
    expect(result.links).toEqual([
      {
        key: 'api|svc:a|svc:b|',
        kind: 'api',
        a: 'svc:a',
        b: 'svc:b',
        row: null,
        vias: new Set(),
        flows: new Set(),
        flags: new Set(['hand']),
      },
      {
        key: 'api|svc:a|svc:b|if:b',
        kind: 'api',
        a: 'svc:a',
        b: 'svc:b',
        row: 'if:b',
        vias: new Set(),
        flows: new Set(),
        flags: new Set(['hand']),
      },
      {
        key: 'data|svc:a|st:db|',
        kind: 'data',
        a: 'svc:a',
        b: 'st:db',
        row: null,
        vias: new Set(),
        flows: new Set(),
        flags: new Set(['hand', 'read']),
      },
      {
        key: 'msg|st:topic|svc:a|',
        kind: 'msg',
        a: 'st:topic',
        b: 'svc:a',
        row: null,
        vias: new Set(),
        flows: new Set(),
        flags: new Set(['hand']),
      },
    ]);
    expect(result.rowsOf.get('svc:b')?.get('if:b')).toEqual({
      id: 'if:b',
      n: 2,
      eps: new Set(['api:get']),
    });
    expect(
      aggregate(value, { ...SHOW_ALL, stores: false, topics: false }).links.map(
        ({ kind, a, b, vias }) => ({ kind, a, b, vias }),
      ),
    ).toContainEqual({ kind: 'msg', a: 'svc:b', b: 'svc:a', vias: new Set(['st:topic']) });
  });
  it('does not invent targets for incomplete stage references or owner-internal reads', () => {
    const result = aggregate(
      input({
        stores: [store('st:owned', { owner: 'svc:a' }), store('st:unknown', { owner: null })],
        refs: {
          'if:unknown': ref('interface'),
          'api:orphan': ref('endpoint'),
          'api:missing': ref('endpoint', { parent: 'if:missing' }),
          'api:unowned': ref('endpoint', { parent: 'if:unknown' }),
          'if:outside': ref('interface', { service: 'missing' }),
          'st:owned': ref('store'),
          'st:unknown': ref('store'),
          'sch:other': ref('schema'),
        },
        stages: [
          {
            id: 'stage:read',
            name: 'Read',
            summary: '',
            entries: [
              {
                svc: 'svc:a',
                reads: [
                  'if:unknown',
                  'api:orphan',
                  'api:missing',
                  'api:unowned',
                  'if:outside',
                  'st:owned',
                  'st:unknown',
                  'sch:other',
                ],
              },
            ],
          },
        ],
      }),
      SHOW_ALL,
    );
    expect(result.links).toEqual([]);
    expect(result.rowsOf.size).toBe(0);
  });
});
