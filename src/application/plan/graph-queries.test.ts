import { describe, expect, it } from 'vitest';

import { buildGraph, systemOf } from '@/application/plan/graph';
import type { Plan } from '@/domain/plan/plan.generated';

import { actingService, baseFanout, canAccess, opKind, serviceLinks } from './graph-queries';

function graph() {
  const value: Plan = {
    meta: { id: 'query', title: 'Trace providers' },
    teams: [],
    problem: { summary: 'Keep access and providers explicit.' },
    services: ['a', 'b', 'c'].map((id) => ({ id: `svc:${id}`, name: id, kind: 'service' })),
    interfaces: [
      {
        id: 'if:b',
        service: 'svc:b',
        protocol: 'rest',
        endpoints: [{ id: 'api:b', sig: 'GET /b' }],
      },
    ],
    stores: [
      {
        id: 'st:data',
        name: 'Data',
        kind: 'database',
        owner: 'svc:b',
        access: [
          { svc: 'svc:a', mode: 'read' },
          { svc: 'svc:c', mode: 'write' },
        ],
      },
      {
        id: 'st:topic',
        name: 'Events',
        kind: 'topic',
        owner: 'svc:b',
        access: [
          { svc: 'svc:a', mode: 'read' },
          { svc: 'svc:c', mode: 'readwrite' },
        ],
      },
      {
        id: 'st:queue',
        name: 'Queue',
        kind: 'queue',
        access: [
          { svc: 'svc:b', mode: 'write' },
          { svc: 'svc:c', mode: 'read' },
        ],
      },
    ],
    schemas: [
      {
        id: 'sch:data',
        name: 'Data',
        kind: 'record',
        store: 'st:data',
        fields: [{ name: 'id', type: 'string' }],
      },
      { id: 'sch:event', name: 'Event', kind: 'payload', store: 'st:topic' },
      { id: 'sch:unplaced', name: 'Unplaced', kind: 'dto' },
    ],
    graphs: [{ id: 'graph:g', name: 'Graph', gateway: 'svc:b' }],
    operations: [
      {
        id: 'gql:read',
        name: 'Read',
        kind: 'query',
        document: 'query Read { value }',
        graph: 'graph:g',
      },
    ],
    messages: [
      {
        id: 'msg:event',
        name: 'Event',
        producer: 'svc:b',
        topic: 'st:topic',
        consumers: ['svc:c', 'missing'],
      },
    ],
    flows: [
      {
        id: 'flow:read',
        name: 'Read',
        steps: [
          {
            id: 'flow:read#call',
            from: 'svc:a',
            to: 'svc:b',
            via: 'api:b',
            action: 'Read',
            reads: ['sch:data#id', 'sch:event', 'sch:unplaced', 'missing'],
            writes: ['sch:data'],
            purges: ['st:data'],
          },
          {
            id: 'flow:read#event',
            from: 'st:topic',
            to: 'svc:a',
            via: 'msg:event',
            action: 'Consume',
          },
          {
            id: 'flow:read#graph',
            from: 'svc:c',
            to: 'svc:b',
            via: 'gql:read',
            action: 'Graph',
            reads: ['sch:data'],
          },
          {
            id: 'flow:read#internal',
            from: 'svc:a',
            to: 'svc:c',
            via: 'internal',
            action: 'Delegate',
          },
        ],
      },
    ],
  };
  return buildGraph(systemOf(value));
}
describe('graph queries', () => {
  it('keeps call direction, acting service, store access and unknown placements in the base fanout', () => {
    const g = graph();
    expect(baseFanout(g, g.steps[0]!)).toEqual({
      calls: [{ from: 'svc:a', to: 'svc:b', via: 'api:b', kind: 'api', fanout: false }],
      data: [
        { svc: 'svc:b', ref: 'sch:data#id', store: 'st:data', rw: 'read' },
        { svc: 'svc:b', ref: 'sch:event', store: null, rw: 'read' },
        { svc: 'svc:b', ref: 'sch:unplaced', store: null, rw: 'read' },
        { svc: 'svc:b', ref: 'missing', store: null, rw: 'read' },
        { svc: 'svc:b', ref: 'sch:data', store: 'st:data', rw: 'write' },
      ],
      purges: [{ svc: 'svc:b', store: 'st:data' }],
      refs: [],
      services: ['svc:a', 'svc:b'],
      subgraphs: [],
      operation: null,
    });
    expect(baseFanout(g, g.steps[1]!)).toMatchObject({
      calls: [{ from: 'st:topic', to: 'svc:a', via: 'msg:event', kind: 'msg', fanout: false }],
      services: ['svc:a'],
      data: [],
      purges: [],
    });
    expect(baseFanout(g, g.steps[2]!)).toMatchObject({
      refs: ['gql:read'],
      operation: 'gql:read',
      data: [],
      subgraphs: [],
    });
    expect(baseFanout(g, g.steps[3]!).calls[0]?.kind).toBe('internal');
    expect(actingService(g, { from: 'svc:a', to: 'st:data' })).toBe('svc:a');
    expect(actingService(g, { from: 'missing', to: 'st:data' })).toBeNull();
  });
  it('grants only owner access or an explicit matching mode', () => {
    const store = graph().stores[0]!;
    expect(canAccess(store, 'svc:b', 'write')).toBe(true);
    expect(canAccess(store, 'svc:a', 'read')).toBe(true);
    expect(canAccess(store, 'svc:a', 'write')).toBe(false);
    expect(canAccess(store, 'svc:c', 'read')).toBe(false);
    expect(canAccess(graph().stores[1]!, 'svc:c', 'write')).toBe(true);
    expect(canAccess(graph().stores[1]!, 'svc:c', 'read')).toBe(true);
    expect(canAccess(graph().stores[2]!, 'missing', 'read')).toBe(false);
    expect(
      [
        null,
        [],
        'add',
        {},
        { add: 'field' },
        { modify: 'x' },
        { deprecate: 'x' },
        { remove: 'x' },
      ].map(opKind),
    ).toEqual([null, null, null, null, 'add', 'modify', 'deprecate', 'remove']);
  });
  it('draws providers towards users once per kind and excludes unknown or self links', () => {
    const g = graph();
    const links = serviceLinks(g);
    expect(links).toEqual([
      { from: 'svc:b', to: 'svc:a', kind: 'api', via: 'api:b' },
      { from: 'svc:b', to: 'svc:c', kind: 'api', via: 'gql:read' },
      { from: 'svc:c', to: 'svc:a', kind: 'api', via: null },
      { from: 'svc:b', to: 'svc:c', kind: 'msg', via: 'msg:event' },
      { from: 'svc:b', to: 'svc:a', kind: 'msg', via: 'msg:event' },
      { from: 'svc:b', to: 'svc:a', kind: 'data', via: 'st:data' },
      { from: 'svc:b', to: 'svc:c', kind: 'data', via: 'st:data' },
      { from: 'svc:c', to: 'svc:a', kind: 'msg', via: 'st:topic' },
    ]);
    const stages = [
      {
        id: 'stage:read',
        name: 'Read',
        services: [
          {
            svc: 'svc:c',
            from: [
              'svc:a',
              'if:b',
              'api:b',
              'st:data',
              'st:topic',
              'st:queue',
              'missing',
              'sch:data',
            ],
          },
        ],
      },
    ];
    expect(serviceLinks(g, stages)).toEqual(
      expect.arrayContaining([
        { from: 'svc:a', to: 'svc:c', kind: 'api', via: null },
        { from: 'svc:b', to: 'svc:c', kind: 'data', via: 'st:data' },
      ]),
    );
    expect(
      serviceLinks(g, stages).every(
        (link) => link.from !== link.to && !link.from.includes('missing'),
      ),
    ).toBe(true);
  });
});
