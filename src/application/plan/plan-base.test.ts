import { describe, expect, it } from 'vitest';

import {
  anchorsOf,
  collectionsOf,
  driftOf,
  fingerprintOf,
  lockOf,
  nodeOf,
  onBase,
  type PlanBase,
  scopeOf,
} from './plan-base';

const base = (): PlanBase => ({
  mode: 'live',
  landedOn: null,
  collections: {
    teams: [{ id: 'team:a', name: 'A' }],
    services: [
      { id: 'svc:web', name: 'Web', team: 'team:a', calls: ['svc:api'] },
      { id: 'svc:api', name: 'API', team: 'team:a' },
      { id: 'svc:far', name: 'Far', team: 'team:a' },
      { id: 'svc:sub', name: 'Sub', team: 'team:a' },
    ],
    interfaces: [
      {
        id: 'if:api',
        service: 'svc:api',
        endpoints: [{ id: 'api:get', name: 'Get' }],
      },
      { id: 'if:far', service: 'svc:far', endpoints: [{ id: 'api:far', name: 'Far' }] },
    ],
    graphs: [{ id: 'graph:g', gateway: 'svc:api' }],
    schemas: [
      {
        id: 'sch:query',
        graph: 'graph:g',
        root: 'query',
        fields: [
          { name: 'near', via: 'api:get' },
          { name: 'far', via: 'api:far' },
          { name: 'plain' },
        ],
      },
      {
        id: 'sch:order',
        fields: [{ name: 'total' }],
        sources: [{ repo: 'r', path: 'p', commit: 'c1' }],
      },
    ],
    screens: [{ id: 'scr:pdp', regions: [{ name: 'delivery', shows: 'A date' }] }],
  },
});

describe('collectionsOf', () => {
  it('keeps only the system collections of a mapping', () => {
    expect(collectionsOf({ services: [{ id: 'svc:x' }, 'junk'], meta: {}, flows: 'no' })).toEqual({
      services: [{ id: 'svc:x' }],
    });
    expect(collectionsOf(null)).toEqual({});
  });
});

describe('scopeOf', () => {
  it('closes over what the plan names, nested ids and mentions included', () => {
    const scope = scopeOf(base(), [{ changes: [{ summary: 'Talk to [[svc:web]]' }] }]);
    expect([...scope].toSorted((a, b) => a.localeCompare(b))).toEqual([
      'svc:api',
      'svc:web',
      'team:a',
    ]);
  });

  it('finds the entity that holds a nested id', () => {
    expect(scopeOf(base(), [{ context: ['api:get'] }]).has('if:api')).toBe(true);
  });

  it('brings a graph’s root types without following them into all of today', () => {
    const scope = scopeOf(base(), [{ context: ['graph:g'] }]);
    expect(scope.has('sch:query')).toBe(true);
    expect(scope.has('svc:far')).toBe(false);
  });
});

describe('onBase', () => {
  it('puts the scoped base first, then what the plan lists itself', () => {
    const { doc, issues } = onBase(
      { meta: { id: 'p' }, services: [{ id: 'svc:new' }] },
      base(),
      new Set(['svc:web']),
    );
    expect(issues).toEqual([]);
    expect(doc.services).toEqual([
      { id: 'svc:web', name: 'Web', team: 'team:a', calls: ['svc:api'] },
      { id: 'svc:new' },
    ]);
    expect(doc.teams).toBeUndefined();
    expect(doc.meta).toEqual({ id: 'p' });
  });

  it('takes the whole base when there is no scope, and copies it', () => {
    const kept = base();
    const { doc } = onBase({}, kept, null);
    expect(doc.services).toHaveLength(4);
    expect(doc.services).not.toBe(kept.collections.services);
    expect(Array.isArray(doc.services) ? doc.services[0] : null).not.toBe(
      kept.collections.services?.[0],
    );
  });

  it('trims a root type to the fields whose resolvers are in scope', () => {
    const scope = scopeOf(base(), [{ context: ['graph:g', 'if:api'] }]);
    const { doc } = onBase({}, base(), scope);
    expect(doc.schemas).toEqual([
      expect.objectContaining({
        id: 'sch:query',
        fields: [{ name: 'near', via: 'api:get' }, { name: 'plain' }],
      }),
    ]);
  });

  it('strips context, and says what it names that today lacks', () => {
    const { doc, issues } = onBase({ context: ['svc:web', 'svc:gone', 7] }, base(), null);
    expect(doc.context).toBeUndefined();
    expect(issues).toEqual([
      { path: 'context[1]', message: 'svc:gone is not in today' },
      { path: 'context[2]', message: '7 is not in today' },
    ]);
  });

  it('tells a plan that lists a thing today has to change it with an op', () => {
    const { issues } = onBase({ services: [{ id: 'svc:api' }, { name: 'no id' }] }, base(), null);
    expect(issues).toEqual([
      {
        path: 'services[0]',
        message: 'svc:api is already in today; change it with an op instead of listing it',
      },
    ]);
  });
});

describe('nodeOf', () => {
  it('finds an entity, a nested id and a named part', () => {
    expect(nodeOf(base(), 'svc:web')).toMatchObject({ name: 'Web' });
    expect(nodeOf(base(), 'if:api#x')).toBeNull();
    expect(nodeOf(base(), 'api:get')).toBeNull();
    expect(nodeOf(base(), 'scr:pdp#delivery')).toEqual({ name: 'delivery', shows: 'A date' });
    expect(nodeOf(base(), 'svc:nobody')).toBeNull();
  });
});

describe('fingerprints and drift', () => {
  const plan = {
    changes: [
      {
        ops: [
          { modify: 'scr:pdp#delivery', set: { shows: 'A promise' } },
          { remove: 'svc:far' },
          { add: 'step', after: 'svc:web', value: {} },
          { add: 'service', value: { id: 'svc:new' } },
        ],
      },
    ],
  };

  it('names what the ops lean on: what they modify, remove and add after', () => {
    expect(anchorsOf(plan)).toEqual(['scr:pdp#delivery', 'svc:far', 'svc:web']);
    expect(anchorsOf('nonsense')).toEqual([]);
  });

  it('is stable under key order and a moved source, and says when a thing is absent', () => {
    expect(fingerprintOf({ a: 1, b: 2 })).toBe(fingerprintOf({ b: 2, a: 1 }));
    expect(fingerprintOf({ a: 1, sources: ['x'] })).toBe(fingerprintOf({ a: 1, sources: ['y'] }));
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }));
    expect(fingerprintOf(null)).toBe('absent');
    expect(fingerprintOf({ a: 1 })).toMatch(/^[\da-f]{8}$/u);
  });

  it('finds what today changed since the lock, and nothing else', () => {
    const lock = lockOf(plan, base());
    expect(Object.keys(lock)).toEqual(['scr:pdp#delivery', 'svc:far', 'svc:web']);
    expect(driftOf(plan, base(), lock)).toEqual([]);

    const moved = base();
    const screen = moved.collections.screens?.[0];
    if (screen === undefined) throw new Error('no screen');
    moved.collections.screens = [{ ...screen, regions: [{ name: 'delivery', shows: 'Soon' }] }];
    moved.collections.services = (moved.collections.services ?? []).filter(
      (s) => s.id !== 'svc:far',
    );
    expect(driftOf(plan, moved, lock)).toEqual(['scr:pdp#delivery', 'svc:far']);
    expect(driftOf(plan, moved, {})).toEqual([]);
  });
});
