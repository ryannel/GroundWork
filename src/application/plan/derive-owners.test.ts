import { describe, expect, it } from 'vitest';

import { createCore } from '@/application/plan/derive-core';
import type { Plan } from '@/domain/plan/plan.generated';

import { createOwners } from './derive-owners';

function ownershipPlan(): Plan {
  return {
    meta: { id: 'ownership', title: 'Keep ownership explicit' },
    problem: { summary: 'Distinguish providers, resources and shared controls.' },
    teams: [
      { id: 'team:a', name: 'A' },
      { id: 'team:b', name: 'B' },
    ],
    services: [
      { id: 'svc:a', name: 'A', kind: 'service', team: 'team:a' },
      { id: 'svc:b', name: 'B', kind: 'service', team: 'team:b' },
      { id: 'svc:c', name: 'C', kind: 'ui', team: 'team:a' },
    ],
    stores: [
      { id: 'st:db', name: 'Records', kind: 'database', owner: 'svc:a' },
      { id: 'st:topic', name: 'Events', kind: 'topic', owner: 'svc:b' },
      { id: 'st:unowned', name: 'Unplaced', kind: 'database' },
    ],
    schemas: [
      {
        id: 'sch:record',
        name: 'Record',
        kind: 'record',
        store: 'st:db',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'old', type: 'string' },
        ],
      },
      { id: 'sch:request', name: 'Request', kind: 'dto' },
      { id: 'sch:response', name: 'Response', kind: 'dto' },
      { id: 'sch:payload', name: 'Payload', kind: 'payload' },
      { id: 'sch:unplaced', name: 'Unplaced', kind: 'dto' },
      {
        id: 'sch:gql',
        name: 'Query',
        kind: 'graph-type',
        graph: 'graph:g',
        root: 'query',
        fields: [
          { name: 'value', type: 'String', subgraphs: ['sg:b'] },
          { name: 'known', type: 'String', subgraphs: ['sg:missing', 'sg:b'] },
          { name: 'key', type: 'ID!' },
        ],
      },
      {
        id: 'sch:other',
        name: 'Other',
        kind: 'graph-type',
        graph: 'graph:other',
        fields: [{ name: 'value', type: 'String' }],
      },
    ],
    interfaces: [
      {
        id: 'if:b',
        service: 'svc:b',
        protocol: 'rest',
        endpoints: [
          { id: 'api:b', sig: 'POST /records', request: 'sch:request', response: 'sch:response' },
        ],
      },
    ],
    messages: [
      {
        id: 'msg:changed',
        name: 'Changed',
        topic: 'st:topic',
        producer: 'svc:b',
        payload: 'sch:payload',
      },
    ],
    handlers: [
      { id: 'h:b', component: 'svc:b', on: 'api:b', steps: [{ does: 'Read the request' }] },
    ],
    graphs: [
      { id: 'graph:g', name: 'Graph', gateway: 'svc:a' },
      { id: 'graph:other', name: 'Other graph', gateway: 'svc:c' },
    ],
    subgraphs: [
      { id: 'sg:b', name: 'B', graph: 'graph:g', service: 'svc:b' },
      { id: 'sg:c', name: 'C', graph: 'graph:g', service: 'svc:c' },
      { id: 'sg:other', name: 'Other', graph: 'graph:other', service: 'svc:a' },
    ],
    operations: [
      {
        id: 'gql:client',
        name: 'Client',
        kind: 'query',
        document: 'query Read { value }',
        graph: 'graph:g',
        client: 'svc:c',
      },
      {
        id: 'gql:screen',
        name: 'Screen',
        kind: 'query',
        document: 'query Read { value }',
        graph: 'graph:g',
        screens: ['scr:a#control'],
      },
      {
        id: 'gql:unknown',
        name: 'Unknown client',
        kind: 'query',
        document: 'query Read { value }',
        graph: 'graph:g',
      },
      {
        id: 'gql:other',
        name: 'Other',
        kind: 'query',
        document: 'query Read { value }',
        graph: 'graph:other',
        client: 'svc:a',
      },
    ],
    screens: [
      {
        id: 'scr:a',
        name: 'A page',
        service: 'svc:a',
        regions: [{ id: 'scr:a#control', name: 'Control' }],
      },
      { id: 'scr:b', name: 'B page', service: 'svc:b' },
    ],
    interactions: [
      {
        id: 'ui:single',
        name: 'Continue',
        from: ['scr:a#control'],
        to: 'scr:b',
        trigger: 'click',
        effect: 'navigate',
      },
      {
        id: 'ui:shared',
        name: 'Shared control',
        from: ['scr:a', 'scr:b'],
        to: 'scr:b',
        trigger: 'click',
        effect: 'navigate',
      },
    ],
    user_journeys: [{ id: 'uj:single', name: 'Continue', interactions: ['ui:single'] }],
    flows: [
      {
        id: 'flow:read',
        name: 'Read',
        steps: [
          { id: 'flow:read#call', from: 'svc:a', to: 'svc:b', via: 'api:b', action: 'Read' },
          {
            id: 'flow:read#write',
            from: 'svc:a',
            to: 'st:db',
            via: 'internal',
            action: 'Write',
            writes: ['sch:record'],
          },
        ],
      },
    ],
    tests: [{ id: 'tst:proof', level: 'unit', name: 'Proof', proves: [], owner: 'team:b' }],
    work_items: [{ id: 'wi:work', title: 'Work', team: 'team:a' }],
    risks: [{ id: 'risk:gap', statement: 'A gap', owner: 'team:b' }],
    questions: [{ id: 'q:owner', question: 'Who owns this?', status: 'open', decider: 'team:a' }],
    changes: [
      {
        id: 'chg:fields',
        title: 'Change fields',
        ops: [
          { modify: 'sch:record#id', set: { type: 'uuid' } },
          { remove: 'sch:record#old' },
          { add: 'field', into: 'sch:record', value: { name: 'new', type: 'string' } },
          { modify: 'sch:gql#value', set: { subgraphs: ['sg:c'] } },
        ],
      },
    ],
  };
}
const load = () => createOwners(createCore(ownershipPlan()));

describe('explicit and derived ownership', () => {
  it('keeps component and declared provider ownership distinct from storage placement', () => {
    const owners = load();
    expect(
      Object.fromEntries(
        [
          'svc:a',
          'if:b',
          'api:b',
          'st:db',
          'msg:changed',
          'h:b',
          'sch:record',
          'sch:request',
          'sch:response',
          'sch:payload',
          'graph:g',
          'sg:b',
          'gql:client',
          'gql:screen',
          'scr:a#control',
          'flow:read#call',
          'flow:read#write',
          'flow:read',
        ].map((id) => [id, owners.ownerService(id)]),
      ),
    ).toEqual({
      'svc:a': 'svc:a',
      'if:b': 'svc:b',
      'api:b': 'svc:b',
      'st:db': 'svc:a',
      'msg:changed': 'svc:b',
      'h:b': 'svc:b',
      'sch:record': 'svc:a',
      'sch:request': 'svc:b',
      'sch:response': 'svc:b',
      'sch:payload': 'svc:b',
      'graph:g': 'svc:a',
      'sg:b': 'svc:b',
      'gql:client': 'svc:c',
      'gql:screen': 'svc:a',
      'scr:a#control': 'svc:a',
      'flow:read#call': 'svc:b',
      'flow:read#write': 'svc:a',
      'flow:read': 'svc:b',
    });
    for (const id of ['missing', 'st:unowned', 'sch:unplaced', 'gql:unknown']) {
      expect(owners.ownerService(id)).toBeNull();
    }
  });
  it('uses a field’s declared resolver, preserves its earlier subgraph membership, and leaves key fields with their composed graph', () => {
    const owners = load();
    expect(owners.ownerService('sch:gql#value')).toBe('svc:c');
    expect(owners.ownerService('sch:gql#known')).toBe('svc:b');
    expect(owners.ownerService('sch:gql#key')).toBe('svc:a');
    expect(owners.descendants('sg:b')).toEqual(['sch:gql#value', 'sch:gql#known']);
    expect(owners.descendants('sg:c')).toEqual(['sch:gql#value']);
    expect(new Set(owners.descendants('graph:g'))).toEqual(
      new Set([
        'sg:b',
        'sg:c',
        'sch:gql',
        'sch:gql#value',
        'sch:gql#known',
        'sch:gql#key',
        'gql:client',
        'gql:screen',
        'gql:unknown',
      ]),
    );
  });
  it('keeps all before-and-after children and counts each change once', () => {
    const owners = load();
    expect(owners.descendants('sch:record')).toEqual([
      'sch:record#id',
      'sch:record#old',
      'sch:record#new',
    ]);
    expect(owners.descendants('st:db')).toEqual([
      'sch:record',
      'sch:record#id',
      'sch:record#old',
      'sch:record#new',
    ]);
    expect(owners.descendants('if:b')).toEqual(['api:b']);
    expect(owners.descendants('flow:read')).toEqual(['flow:read#call', 'flow:read#write']);
    expect(owners.descendants('scr:a')).toEqual(['scr:a#control']);
    expect(owners.descendants('api:b')).toEqual([]);
    expect(owners.descendants('missing')).toEqual([]);
    expect(owners.rollup('sch:record')).toEqual({
      added: 1,
      modified: 1,
      removed: 1,
      deprecated: 0,
      total: 3,
    });
    expect(owners.rollup('missing')).toEqual({
      added: 0,
      modified: 0,
      removed: 0,
      deprecated: 0,
      total: 0,
    });
  });
  it('takes navigation ownership from source controls and leaves multi-app ownership as a visible gap', () => {
    const owners = load();
    expect(owners.ownerService('ui:single')).toBe('svc:a');
    expect(owners.ownerService('uj:single')).toBe('svc:a');
    expect(owners.ownerTeam('ui:single')).toBe('team:a');
    expect(owners.ownerService('ui:shared')).toBeNull();
    expect(owners.ownerTeam('ui:shared')).toBeNull();
    expect(owners.navigationTeams('ui:shared')).toEqual(['team:a', 'team:b']);
    const value = ownershipPlan();
    value.changes!.push({
      id: 'chg:navigate',
      title: 'Move the control',
      ops: [{ modify: 'ui:single', set: { from: ['scr:b'] } }],
    });
    const moved = createOwners(createCore(value));
    expect(moved.ownerService('ui:single')).toBeNull();
    expect(moved.ownerTeam('ui:single')).toBeNull();
    value.services.find((service) => service.id === 'svc:b')!.team = 'team:a';
    const sameTeam = createOwners(createCore(value));
    expect(sameTeam.ownerService('ui:single')).toBeNull();
    expect(sameTeam.ownerTeam('ui:single')).toBe('team:a');
  });
  it('respects explicit plan-level team fields and does not put cross-owner flows inside a service or team', () => {
    const owners = load();
    expect(
      ['team:a', 'svc:a', 'wi:work', 'tst:proof', 'risk:gap', 'q:owner', 'missing'].map((id) =>
        owners.ownerTeam(id),
      ),
    ).toEqual(['team:a', 'team:a', 'team:a', 'team:b', 'team:b', 'team:a', null]);
    expect(owners.descendants('svc:b')).toContain('h:b');
    expect(owners.descendants('svc:b')).not.toContain('svc:b');
    expect(owners.descendants('svc:b')).not.toContain('flow:read');
    expect(owners.descendants('svc:b')).not.toContain('flow:read#call');
    expect(owners.descendants('team:a')).toContain('svc:a');
    expect(owners.descendants('team:a')).not.toContain('team:a');
    expect(owners.descendants('team:a')).not.toContain('team:b');
    expect(owners.descendants('team:a')).not.toContain('flow:read');
  });
});
