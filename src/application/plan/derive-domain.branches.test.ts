import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

/**
 * mini.yaml with stages in an odd order (billing before placing), an empty stage, Analytics in no stage, a flow
 * split evenly between two stages, a flow of stores only, and an event on a topic that is not modelled.
 */
async function withOddDomain(): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.stores = [
    ...(p.stores ?? []),
    { id: 'st:lake', name: 'lake', kind: 'warehouse', owner: 'svc:analytics' },
  ];
  p.messages = [
    ...(p.messages ?? []),
    {
      id: 'msg:ghost',
      name: 'ghost',
      topic: 'st:nowhere',
      producer: 'svc:billing',
      consumers: ['svc:web'],
    },
  ];
  p.flows = [
    ...(p.flows ?? []),
    {
      id: 'flow:tie',
      name: 'Split evenly',
      steps: [
        { id: 'flow:tie#ask', from: 'svc:web', to: 'svc:subs', via: 'internal', action: 'Ask' },
        {
          id: 'flow:tie#bill',
          from: 'svc:subs',
          to: 'svc:billing',
          via: 'internal',
          action: 'Bill',
        },
      ],
    },
    {
      id: 'flow:pipes',
      name: 'Stores only',
      steps: [
        {
          id: 'flow:pipes#copy',
          from: 'st:sub-events',
          to: 'st:lake',
          via: 'internal',
          action: 'Copy',
        },
      ],
    },
  ];
  p.domain = {
    summary: 'Billing first, oddly.',
    concepts: [
      { id: 'con:member', name: 'Member', means: 'Someone who pays.' },
      { id: 'con:card', name: 'Card', means: 'How they pay.' },
    ],
    stages: [
      { id: 'stage:empty', name: 'Empty' },
      {
        id: 'stage:bill',
        name: 'Bill',
        services: [{ svc: 'svc:billing', from: ['sch:invoice', 'st:billing-db'] }],
      },
      { id: 'stage:place', name: 'Place', services: [{ svc: 'svc:web' }, { svc: 'svc:subs' }] },
    ],
  };
  return p;
}

const keyOf = (l: { readonly from: string; readonly to: string }) => `${l.from}>${l.to}`;

describe('the domain, on an odd plan', () => {
  it('gives a flow split evenly the earlier stage, and none to a flow no service acts in', async () => {
    const d = derive(await withOddDomain()).domain();
    expect(d.stageOf('flow:tie')).toBe('stage:bill');
    expect(d.stageOf('flow:tie#bill')).toBe('stage:bill');
    expect(d.stageOf('flow:pipes')).toBeNull();
    expect(d.stageOf('flow:ghost')).toBeNull();
    expect(d.flowsIn('stage:empty')).toEqual([]);
  });

  it('has no stage for a service outside every stage, or what it owns', async () => {
    const d = derive(await withOddDomain()).domain();
    expect(d.stageOf('svc:analytics')).toBeNull();
    expect(d.stageOf('st:lake')).toBeNull();
    expect(d.stageOf('st:billing-db')).toBe('stage:bill');
    expect(d.stageIndex('stage:nowhere')).toBe(-1);
  });

  it('reads a role from the plan’s new things too, and relates no concept that says nothing of another', async () => {
    const d = derive(await withOddDomain()).domain();
    expect(d.roleOf('api:subs-pause')).toBeNull();
    expect(d.roleOf('svc:nowhere')).toBeNull();
    expect(d.relatedTo('con:member')).toEqual([]);
    expect(d.summary).toBe('Billing first, oddly.');
  });

  it('orients links from the earlier stage, through the event when its topic is not modelled', async () => {
    const links = derive(await withOddDomain()).domainLinks('asIs');
    const byKey = new Map(links.map((l) => [keyOf(l), l]));
    expect(byKey.get('svc:billing>svc:web')).toMatchObject({
      via: ['msg:ghost'],
      kinds: ['msg'],
      same: false,
    });
    expect(byKey.get('svc:billing>svc:subs')?.kinds).toEqual(['msg']);
    expect(links.every((l) => l.from !== l.to)).toBe(true);
    expect(links.some((l) => l.from === 'svc:analytics' || l.to === 'svc:analytics')).toBe(false);
  });

  it('links the plan’s to-be the same way, with the new pause call inside one stage', async () => {
    const links = derive(await withOddDomain()).domainLinks('toBe');
    const web = links.find((l) => keyOf(l) === 'svc:web>svc:subs');
    expect(web?.kinds).toEqual(['api']);
    expect(web?.same).toBe(true);
    expect(web?.via).toEqual(expect.arrayContaining(['if:subs-rest']));
  });
});
