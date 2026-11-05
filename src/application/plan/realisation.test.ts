import { describe, expect, it } from 'vitest';

import {
  hasAuthority,
  originsOf,
  realisationOf,
  realiseChange,
  realiseOp,
  rollUp,
  type TodayFacts,
  todayModelOf,
} from '@/application/plan/realisation';
import type { Change, Op } from '@/domain/plan/plan.generated';

// Today marks a deprecated thing in a way the plan schema does not name yet.
const old = {
  id: 'svc:old',
  name: 'Old',
  kind: 'service' as const,
  team: 'team:shop',
  deprecated: true,
};

const facts: TodayFacts = {
  system: {
    services: [
      { id: 'svc:checkout', name: 'Checkout', kind: 'service', team: 'team:shop', tech: 'node' },
      { id: 'svc:ziklo', name: 'Ziklo', kind: 'external', team: 'team:ziklo' },
      old,
      { id: 'svc:seed', name: 'Seed', kind: 'service', team: 'team:shop' },
    ],
    schemas: [
      {
        id: 'sch:order',
        name: 'Order',
        kind: 'record',
        fields: [{ name: 'status', type: 'string' }],
      },
    ],
    interfaces: [
      {
        id: 'api:checkout',
        service: 'svc:checkout',
        protocol: 'rest',
        endpoints: [{ id: 'api:checkout-pay', sig: 'POST /pay' }],
      },
      {
        id: 'api:ziklo',
        service: 'svc:ziklo',
        protocol: 'rest',
        endpoints: [{ id: 'api:ziklo-quote', sig: 'POST /quote' }],
      },
      {
        id: 'api:draft',
        service: 'svc:checkout',
        protocol: 'rest',
        endpoints: [{ id: 'api:draft-quote', sig: 'POST /draft' }],
      },
    ],
    messages: [{ id: 'msg:paid', name: 'Paid', topic: 'orders.paid', consumers: ['svc:checkout'] }],
  },
  origins: originsOf({
    'svc:checkout': { origin: 'extracted' },
    'api:checkout-pay': { origin: 'curated' },
    'api:ziklo': { origin: 'documented' },
    'api:ziklo-quote': { origin: 'documented' },
    'api:draft': { origin: 'documented' },
    'svc:seed': { origin: 'seeded' },
  }),
  ownerTeam: (id) => {
    if (id.startsWith('api:ziklo') || id === 'svc:ziklo') return 'team:ziklo';
    return id.startsWith('msg:') ? null : 'team:shop';
  },
  partners: ['team:ziklo'],
};

// Built inside each test, so mutation testing can tell which test covers which line.
const today = () => todayModelOf(facts);

const addEndpoint = (id: string, into: string, sig: string): Op => ({
  add: 'endpoint',
  into,
  value: { id, sig },
});
const judge = (op: Op) => realiseOp(op, today());

describe('an add op', () => {
  it('is missing until today has the thing it adds, and matches once it does', () => {
    expect(
      judge({ add: 'service', value: { id: 'svc:new', name: 'New', kind: 'service' } }),
    ).toEqual({ target: 'svc:new', state: 'missing', detail: 'today has no svc:new' });
    expect(
      judge({ add: 'service', value: { id: 'svc:checkout', name: 'Checkout', kind: 'service' } }),
    ).toEqual({ target: 'svc:checkout', state: 'matches', detail: 'today has svc:checkout' });
  });

  it('finds a field by its schema and name', () => {
    expect(
      judge({ add: 'field', into: 'sch:order', value: { name: 'status', type: 'string' } }).state,
    ).toBe('matches');
    expect(
      judge({ add: 'field', into: 'sch:order', value: { name: 'reason', type: 'string' } }),
    ).toMatchObject({ target: 'sch:order#reason', state: 'missing' });
  });

  it('differs when today has an endpoint by that id with another signature', () => {
    expect(
      judge({
        add: 'endpoint',
        into: 'api:checkout',
        value: { id: 'api:checkout-pay', sig: 'POST /pay' },
      }).state,
    ).toBe('matches');
    expect(
      judge({
        add: 'endpoint',
        into: 'api:checkout',
        value: { id: 'api:checkout-pay', sig: 'PUT /pay' },
      }),
    ).toEqual({
      target: 'api:checkout-pay',
      state: 'differs',
      detail: 'today\'s sig is "POST /pay"; the plan\'s is "PUT /pay"',
    });
  });

  it('differs when today has a message by that id on another topic', () => {
    expect(
      judge({ add: 'message', value: { id: 'msg:paid', name: 'Paid', topic: 'orders.paid' } })
        .state,
    ).toBe('matches');
    expect(
      judge({ add: 'message', value: { id: 'msg:paid', name: 'Paid', topic: 'payments.paid' } })
        .state,
    ).toBe('differs');
  });
});

describe('a modify op', () => {
  it('matches when today has every value it sets, is partial with some, and missing with none', () => {
    expect(judge({ modify: 'svc:checkout', set: { tech: 'node', name: 'Checkout' } })).toEqual({
      target: 'svc:checkout',
      state: 'matches',
      detail: 'today says all 2 of 2',
    });
    expect(judge({ modify: 'svc:checkout', set: { tech: 'node', name: 'Till' } })).toEqual({
      target: 'svc:checkout',
      state: 'partial',
      detail: 'today says 1 of 2',
    });
    expect(judge({ modify: 'svc:checkout', set: { tech: 'java', name: 'Till' } })).toEqual({
      target: 'svc:checkout',
      state: 'missing',
      detail: 'today says none of the 2',
    });
  });

  it('matches an append when every appended item is in today, and a drop when each is gone', () => {
    expect(judge({ modify: 'msg:paid', append: { consumers: ['svc:checkout'] } }).state).toBe(
      'matches',
    );
    expect(
      judge({ modify: 'msg:paid', append: { consumers: ['svc:checkout', 'svc:mailer'] } }).state,
    ).toBe('partial');
    expect(judge({ modify: 'msg:paid', append: { consumers: ['svc:mailer'] } }).state).toBe(
      'missing',
    );
    expect(judge({ modify: 'msg:paid', drop: { consumers: ['svc:mailer'] } }).state).toBe(
      'matches',
    );
    expect(judge({ modify: 'msg:paid', drop: { consumers: ['svc:checkout'] } }).state).toBe(
      'missing',
    );
  });

  it('compares whole values regardless of key order', () => {
    expect(
      judge({ modify: 'sch:order', set: { fields: [{ type: 'string', name: 'status' }] } }).state,
    ).toBe('matches');
  });

  it('is missing when today has no such thing', () => {
    expect(judge({ modify: 'svc:gone', set: { tech: 'node' } })).toEqual({
      target: 'svc:gone',
      state: 'missing',
      detail: 'today has no svc:gone',
    });
  });
});

describe('a remove or deprecate op', () => {
  it('matches once today no longer has the thing', () => {
    expect(judge({ remove: 'svc:gone' }).state).toBe('matches');
    expect(judge({ remove: 'svc:checkout' })).toEqual({
      target: 'svc:checkout',
      state: 'missing',
      detail: 'today still has svc:checkout',
    });
  });

  it('matches a deprecation once today marks the thing deprecated, or no longer has it', () => {
    expect(judge({ deprecate: 'svc:old' })).toEqual({
      target: 'svc:old',
      state: 'matches',
      detail: 'today marks svc:old deprecated',
    });
    expect(judge({ deprecate: 'svc:gone' }).state).toBe('matches');
    expect(judge({ deprecate: 'svc:checkout' }).state).toBe('missing');
  });
});

describe('authority', () => {
  it('counts code and people, and a document only when it is the owning partner team’s', () => {
    expect(hasAuthority('extracted', 'team:shop', [])).toBe(true);
    expect(hasAuthority('curated', null, [])).toBe(true);
    expect(hasAuthority(null, null, [])).toBe(true);
    expect(hasAuthority('documented', 'team:ziklo', ['team:ziklo'])).toBe(true);
    expect(hasAuthority('documented', 'team:shop', ['team:ziklo'])).toBe(false);
    expect(hasAuthority('documented', null, ['team:ziklo'])).toBe(false);
    expect(hasAuthority('seeded', 'team:shop', ['team:shop'])).toBe(false);
  });

  it('realises an op from a partner’s own document, but not from a document about our system', () => {
    expect(judge(addEndpoint('api:ziklo-quote', 'api:ziklo', 'POST /quote')).state).toBe('matches');
    expect(judge(addEndpoint('api:draft-quote', 'api:draft', 'POST /draft'))).toEqual({
      target: 'api:draft-quote',
      state: 'missing',
      detail: 'today has it only from a documented source, which does not make it so',
    });
  });

  it('does not let the demo seed realise anything, nor hold back a removal', () => {
    expect(judge({ modify: 'svc:seed', set: { name: 'Seed' } }).state).toBe('missing');
    expect(judge({ remove: 'svc:seed' }).state).toBe('matches');
  });
});

describe('a part of a thing', () => {
  it('takes its holder’s origin and owner when it has none of its own', () => {
    const partOf = todayModelOf({
      system: {
        services: [{ id: 'svc:ziklo', name: 'Ziklo', kind: 'external', team: 'team:ziklo' }],
        interfaces: [
          {
            id: 'api:ziklo',
            service: 'svc:ziklo',
            protocol: 'rest',
            endpoints: [{ id: 'api:ziklo-order', sig: 'GET /order' }],
          },
        ],
        schemas: [
          { id: 'sch:quote', name: 'Quote', kind: 'dto', fields: [{ name: 'rate', type: 'int' }] },
        ],
      },
      origins: { 'api:ziklo': 'documented', 'sch:quote': 'documented' },
      ownerTeam: (id) => (id === 'api:ziklo' || id === 'sch:quote' ? 'team:ziklo' : null),
      partners: ['team:ziklo'],
    });
    expect(partOf.find('api:ziklo-order')).toMatchObject({ counts: true, origin: 'documented' });
    expect(partOf.find('sch:quote#rate')).toMatchObject({ counts: true, origin: 'documented' });
    expect(partOf.find('svc:ziklo')).toMatchObject({ counts: true, origin: null });
    expect(partOf.find('svc:none')).toBeNull();
  });
});

describe('a change', () => {
  const change = (ops?: readonly Op[]): Change => ({
    id: 'chg:x',
    title: 'X',
    ...(ops === undefined ? {} : { ops: [...ops] }),
  });
  const there: Op = { remove: 'svc:gone' };
  const notYet: Op = { remove: 'svc:checkout' };
  const wrong: Op = { add: 'message', value: { id: 'msg:paid', name: 'Paid', topic: 'x' } };

  it('rolls its ops up: matches when all match, missing when all are missing', () => {
    expect(realiseChange(change([there, there]), today()).state).toBe('matches');
    expect(realiseChange(change([notYet, notYet]), today()).state).toBe('missing');
    expect(realiseChange(change([there, notYet]), today()).state).toBe('partial');
    expect(realiseChange(change([there, wrong]), today()).state).toBe('differs');
    expect(realiseChange(change([notYet, wrong]), today()).state).toBe('differs');
  });

  it('is missing while it has no ops, and lists each op with its place', () => {
    expect(realiseChange(change(), today())).toEqual({
      change: 'chg:x',
      state: 'missing',
      ops: [],
    });
    expect(realiseChange(change([there, notYet]), today()).ops.map((op) => op.op)).toEqual([0, 1]);
  });

  it('is worked out for every change of a plan', () => {
    expect(realisationOf({ changes: [change([there])] }, today())).toHaveLength(1);
    expect(realisationOf({}, today())).toEqual([]);
  });

  it('rolls up a partial op as partial', () => {
    expect(rollUp(['partial'])).toBe('partial');
    expect(rollUp(['matches', 'partial'])).toBe('partial');
    expect(rollUp([])).toBe('missing');
  });
});
