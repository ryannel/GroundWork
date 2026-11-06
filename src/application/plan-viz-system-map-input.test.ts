import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

import { systemMapInput } from './plan-viz-system-map-input';

function mapPlan(): Plan {
  return {
    meta: { id: 'map-input', title: 'Map the calls' },
    problem: { summary: 'Transport only the current model.' },
    teams: [{ id: 'team:a', name: 'A team', colour: 3 }],
    systems: [{ id: 'sys:one', name: 'One', team: 'team:a' }],
    services: [
      {
        id: 'svc:a',
        name: 'A',
        kind: 'service',
        team: 'team:a',
        system: 'sys:one',
        does: ' Keeps orders ',
        infrastructure: true,
      },
      { id: 'svc:b', name: 'B', kind: 'service' },
      { id: 'svc:c', name: 'C', kind: 'service', team: 'team:a', system: 'sys:one' },
    ],
    stores: [
      { id: 'st:db', name: 'Orders', kind: 'database', owner: 'svc:a' },
      { id: 'st:topic', name: 'Events', kind: 'topic', owner: 'svc:a' },
      { id: 'st:queue', name: 'Queue', kind: 'queue' },
    ],
    schemas: [{ id: 'sch:order', name: 'Order', kind: 'record', store: 'st:db' }],
    interfaces: [
      {
        id: 'if:a',
        service: 'svc:a',
        protocol: 'rest',
        endpoints: [
          { id: 'api:get', sig: 'GET /orders', response: 'sch:order' },
          { id: 'api:ping', sig: 'GET /ping' },
        ],
      },
    ],
    messages: [
      {
        id: 'msg:changed',
        name: ' changed ',
        topic: 'st:topic',
        producer: 'svc:a',
        consumers: ['svc:b'],
      },
      { id: 'msg:blank', name: '   ', topic: 'st:queue', producer: 'svc:b', consumers: [] },
    ],
    flows: [
      {
        id: 'flow:read',
        name: 'Read orders',
        steps: [
          { id: 'flow:read#get', from: 'svc:b', to: 'svc:a', via: 'api:get', action: 'Get orders' },
          {
            id: 'flow:read#ping',
            from: 'svc:b',
            to: 'svc:a',
            via: 'api:ping',
            action: 'Check health',
          },
          {
            id: 'flow:read#write',
            from: 'svc:a',
            to: 'st:db',
            via: 'internal',
            action: 'Keep orders',
            writes: ['sch:order'],
          },
          {
            id: 'flow:read#publish',
            from: 'svc:a',
            to: 'st:topic',
            via: 'msg:changed',
            action: 'Announce orders',
          },
        ],
      },
    ],
    domain: {
      stages: [
        {
          id: 'stage:one',
          name: 'First',
          summary: '**Read** the orders.',
          services: [{ svc: 'svc:a', from: ['api:get', 'st:db', 'if:a', 'svc:b', 'missing'] }],
        },
        { id: 'stage:two', name: 'Next', services: [{ svc: 'svc:b', from: ['st:topic'] }] },
      ],
    },
    changes: [
      {
        id: 'chg:new',
        title: 'Add a service',
        ops: [{ add: 'service', value: { id: 'svc:new', name: 'New', kind: 'service' } }],
      },
    ],
  };
}
describe('plain system-map input', () => {
  it('keeps current identities, recorded teams, infrastructure and explicit system placement', () => {
    const result = systemMapInput(derive(mapPlan()));
    expect(result.services).toEqual([
      {
        id: 'svc:a',
        name: 'A',
        kind: 'service',
        does: 'Keeps orders',
        team: 'team:a',
        teamSlot: 3,
        system: 'sys:one',
        infrastructure: true,
      },
      { id: 'svc:b', name: 'B', kind: 'service', does: '', team: null, teamSlot: 8, system: null },
      {
        id: 'svc:c',
        name: 'C',
        kind: 'service',
        does: '',
        team: 'team:a',
        teamSlot: 3,
        system: 'sys:one',
      },
    ]);
    expect(result.systems).toEqual([
      {
        id: 'sys:one',
        name: 'One',
        kind: '',
        does: '',
        team: 'team:a',
        teamSlot: 3,
        parts: 2,
        stores: 2,
      },
    ]);
    expect(result.lens).toBeNull();
    expect(result.focus).toBeNull();
    expect(systemMapInput(derive(mapPlan()), 'team:a').lens).toBe('team:a');
    expect(result.services.some((service) => service.id === 'svc:new')).toBe(false);
    const serialized = JSON.stringify(result);
    const restored: unknown = JSON.parse(serialized);
    expect(restored).toEqual(result);
  });
  it('distinguishes stores and pipes, retaining known owners and visible missing ones', () => {
    const result = systemMapInput(derive(mapPlan()));
    expect(result.stores).toEqual([
      {
        id: 'st:db',
        name: 'Orders',
        kind: 'database',
        does: '',
        team: 'team:a',
        teamSlot: 3,
        topic: false,
        owner: 'svc:a',
        carries: [],
      },
      {
        id: 'st:topic',
        name: 'Events',
        kind: 'topic',
        does: '',
        team: 'team:a',
        teamSlot: 3,
        topic: true,
        owner: 'svc:a',
        carries: ['changed'],
      },
      {
        id: 'st:queue',
        name: 'Queue',
        kind: 'queue',
        does: '',
        team: null,
        teamSlot: 8,
        topic: true,
        owner: null,
        carries: ['msg:blank'],
      },
    ]);
  });
  it('transports stages and only resolvable stage references, including an endpoint’s interface', () => {
    const result = systemMapInput(derive(mapPlan()));
    expect(result.stages).toEqual([
      {
        id: 'stage:one',
        name: 'First',
        summary: 'Read the orders.',
        entries: [{ svc: 'svc:a', reads: ['api:get', 'st:db', 'if:a', 'svc:b', 'missing'] }],
      },
      {
        id: 'stage:two',
        name: 'Next',
        summary: '',
        entries: [{ svc: 'svc:b', reads: ['st:topic'] }],
      },
    ]);
    expect(result.stageOf).toEqual({ 'svc:a': 0, 'svc:b': 1 });
    expect(result.refs).toEqual({
      'api:get': { type: 'endpoint', service: null, parent: 'if:a', topic: false },
      'if:a': { type: 'interface', service: 'svc:a', parent: null, topic: false },
      'st:db': { type: 'store', service: null, parent: null, topic: false },
      'svc:b': { type: 'service', service: null, parent: null, topic: false },
      'st:topic': { type: 'store', service: null, parent: null, topic: true },
    });
  });
  it('keeps edge provenance, step identities, transport words and browser labels without a browser-side model', () => {
    const result = systemMapInput(derive(mapPlan()));
    expect(result.edges).toContainEqual({
      kind: 'api',
      from: 'svc:b',
      to: 'svc:a',
      via: 'api:get',
      steps: ['flow:read#get'],
      read: false,
      write: false,
    });
    expect(result.steps).toEqual([
      { id: 'flow:read#get', from: 'svc:b', to: 'svc:a', via: 'api:get' },
      { id: 'flow:read#ping', from: 'svc:b', to: 'svc:a', via: 'api:ping' },
      { id: 'flow:read#write', from: 'svc:a', to: 'st:db', via: 'internal' },
      { id: 'flow:read#publish', from: 'svc:a', to: 'st:topic', via: 'msg:changed' },
    ]);
    expect(result.interfaceOf['api:get']).toBe('if:a');
    expect(result.callWords?.['api:get']).toBe('REST call');
    expect(result.carries?.['api:get']).toBe('Order');
    expect(result.labels).toMatchObject({
      'svc:a': 'A',
      'st:db': 'Orders',
      'sys:one': 'One',
      'flow:read': 'Read orders',
      'team:a': 'A team',
    });
    expect(Object.hasOwn(result.labels, '')).toBe(false);
    expect(result.refs).not.toHaveProperty('missing');
  });
});
