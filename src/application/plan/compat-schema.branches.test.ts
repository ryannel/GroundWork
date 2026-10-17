import { describe, expect, it } from 'vitest';

import { createSchemaCompat, type Env, successorsOf } from '@/application/plan/compat-schema';
import { buildGraph } from '@/application/plan/graph';
import type { OpRecord, SystemGraph } from '@/domain/plan/plan-graph';
import type {
  Flow,
  Interface,
  Message,
  Schema,
  Service,
  Store,
} from '@/domain/plan/plan.generated';

const svc = (id: string): Service => ({ id, name: id, team: 'team:t', kind: 'service' });

const SERVICES = [svc('svc:a'), svc('svc:b'), svc('svc:c')];

const STORES: Store[] = [
  {
    id: 'st:db',
    name: 'db',
    kind: 'database',
    owner: 'svc:a',
    access: [
      { svc: 'svc:b', mode: 'read' },
      { svc: 'svc:c', mode: 'write' },
    ],
  },
  { id: 'st:topic', name: 'topic', kind: 'topic', owner: 'svc:a' },
];

const schema = (id: string, kind: Schema['kind'], more: Partial<Schema> = {}): Schema => ({
  id,
  name: id,
  kind,
  fields: [
    { name: 'id', type: 'uuid' },
    { name: 'note', type: 'string' },
  ],
  ...more,
});

const SCHEMAS: Schema[] = [
  schema('sch:rec', 'record', { store: 'st:db' }),
  schema('sch:req', 'dto'),
  schema('sch:res', 'dto'),
  schema('sch:pay', 'payload'),
  schema('sch:gql', 'graph-type'),
  schema('sch:loose', 'dto'),
];

const INTERFACES: Interface[] = [
  {
    id: 'if:a',
    service: 'svc:a',
    protocol: 'rest',
    endpoints: [{ id: 'api:x', sig: 'POST /x', request: 'sch:req', response: 'sch:res' }],
  },
];

const MESSAGE: Message = {
  id: 'msg:m',
  name: 'm',
  topic: 'st:topic',
  payload: 'sch:pay',
  producer: 'svc:a',
  consumers: ['svc:b'],
};

const FLOWS: Flow[] = [
  {
    id: 'flow:f',
    name: 'f',
    steps: [
      { id: 'flow:f#call', from: 'svc:b', to: 'svc:a', via: 'api:x', action: 'Call' },
      {
        id: 'flow:f#store',
        from: 'svc:a',
        to: 'st:db',
        via: 'internal',
        action: 'Keep',
        writes: ['sch:rec'],
      },
      { id: 'flow:f#pub', from: 'svc:a', to: 'st:topic', via: 'msg:m', action: 'Publish' },
      { id: 'flow:f#sub', from: 'st:topic', to: 'svc:b', via: 'msg:m', action: 'Consume' },
    ],
  },
];

const asIs = buildGraph({
  services: SERVICES,
  stores: STORES,
  schemas: SCHEMAS,
  interfaces: INTERFACES,
  messages: [MESSAGE],
  flows: FLOWS,
});

const record = (o: Partial<OpRecord>): OpRecord => ({
  kind: 'add',
  changeId: 'chg:other',
  changeIndex: 0,
  opIndex: 0,
  path: [],
  target: null,
  type: 'step',
  ids: [],
  props: [],
  problems: [],
  warnings: [],
  ...o,
});

function envOf(toBe: SystemGraph, more: Partial<Env> = {}): Env {
  return {
    asIs,
    toBe,
    records: [],
    changed: new Map(),
    operationsSelecting: () => [],
    status: () => null,
    versions: () => ({}),
    ...more,
  };
}

/** Today without the named schemas, and with the rest as given. */
const without = (ids: readonly string[], more: Parameters<typeof buildGraph>[0] = {}) =>
  buildGraph({
    services: SERVICES,
    stores: STORES,
    schemas: SCHEMAS.filter((s) => !ids.includes(s.id)),
    interfaces: INTERFACES,
    messages: [MESSAGE],
    flows: FLOWS,
    ...more,
  });

const noteOf = (id: string, ids: readonly string[]) =>
  createSchemaCompat(envOf(without(ids)))(id)
    .reasons.map((r) => r.text)
    .join(' / ');

describe('a removed schema, by the role it played', () => {
  it('breaks the callers of the endpoint it was the request of', () => {
    const r = createSchemaCompat(envOf(without(['sch:req'])))('sch:req');
    expect(r.verdict).toBe('breaking');
    expect(r.who.map((w) => [w.svc, w.role])).toEqual([['svc:b', 'caller']]);
    expect(r.reasons[0]).toMatchObject({ rule: 'remove', text: 'it is removed' });
  });

  it('breaks the consumers of the message it was the payload of', () => {
    const r = createSchemaCompat(envOf(without(['sch:pay'])))('sch:pay');
    expect(r.who.map((w) => [w.svc, w.role])).toEqual([['svc:b', 'consumer']]);
  });

  it('breaks whoever reads it: store readers, the callers that get it back, or nobody recorded', () => {
    const rec = createSchemaCompat(envOf(without(['sch:rec'])))('sch:rec');
    // svc:a only writes the rows and svc:c may only write them, so svc:b is the one reader
    expect(rec.who.map((w) => `${w.svc}:${w.role}`)).toEqual(['svc:b:reader']);
    const back = createSchemaCompat(envOf(without(['sch:res'])))('sch:res');
    expect(back.who.map((w) => `${w.svc}:${w.role}`)).toEqual(['svc:b:reader']);
    expect(noteOf('sch:gql', ['sch:gql'])).toContain('no reader recorded');
    expect(noteOf('sch:loose', ['sch:loose'])).toContain('no reader recorded');
  });

  it('judges only the role it is asked about when given a scope', () => {
    const judgeOf = createSchemaCompat(envOf(without(['sch:loose'])));
    const scope = { record: false, request: ['api:x'], response: [], payload: [], graph: false };
    const scoped = judgeOf('sch:loose', scope);
    expect(scoped.who.map((w) => `${w.svc}:${w.role}`)).toEqual(['svc:b:caller']);
    expect(judgeOf('sch:loose').who).toEqual([]);
    expect(judgeOf('sch:loose', scope)).toBe(scoped);
  });

  it('calls a schema that is new in the plan safe, with nothing to judge', () => {
    const r = createSchemaCompat(envOf(asIs))('sch:brand-new');
    expect(r.verdict).toBe('safe');
    expect(r.reasons).toEqual([]);
    expect(r.targets.size).toBe(0);
  });
});

function trimmed(id: string): Schema[] {
  return SCHEMAS.map((s) => (s.id === id ? { ...s, fields: [{ name: 'id', type: 'uuid' }] } : s));
}

describe('a removed field, and who moves with it', () => {
  it('asks which graph operations select a removed graph field', () => {
    const toBe = without([], { schemas: trimmed('sch:gql') });
    const env = envOf(toBe, {
      operationsSelecting: (id) => (id === 'sch:gql#note' ? ['op:page'] : []),
    });
    const r = createSchemaCompat(env)('sch:gql');
    expect(r.who.map((w) => [w.svc, w.role, w.target])).toEqual([
      ['op:page', 'reader', 'sch:gql#note'],
    ]);
    expect(r.verdict).toBe('breaking');
  });

  it('counts a consumer that now listens to the next version as moved, by the change that adds the step', () => {
    const next: Message = { ...MESSAGE, id: 'msg:m2', supersedes: 'msg:m' };
    const flows: Flow[] = [
      ...FLOWS,
      {
        id: 'flow:g',
        name: 'g',
        steps: [
          { id: 'flow:g#sub', from: 'st:topic', to: 'svc:b', via: 'msg:m2', action: 'Consume v2' },
        ],
      },
    ];
    const toBe = without([], { schemas: trimmed('sch:pay'), messages: [MESSAGE, next], flows });
    const value = { via: 'msg:m2', to: 'svc:b' };
    const env = envOf(toBe, {
      records: [
        record({ kind: 'modify', value }),
        record({ type: 'flow', value }),
        record({ value: { via: 'msg:other', to: 'svc:b' } }),
        record({ value: { via: 'msg:m2', to: 'svc:c' } }),
        record({ changeId: 'chg:move', value }),
      ],
    });
    expect(successorsOf(env, ['msg:m'])).toEqual(['msg:m2']);
    const r = createSchemaCompat(env)('sch:pay');
    expect(r.verdict).toBe('migration');
    expect(r.who.map((w) => w.movedBy)).toEqual([
      { step: null, rung: 'msg:m2', change: 'chg:move' },
    ]);
  });

  it('names the successor the versions give, and drops empty ones', () => {
    const env = envOf(asIs, {
      versions: (id) => (id === 'msg:m' ? { replacedBy: 'msg:m3' } : { replacedBy: '' }),
    });
    expect(successorsOf(env, ['msg:m', 'msg:none'])).toEqual(['msg:m3']);
  });
});
