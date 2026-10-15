import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { buildGraph, systemOf } from '@/application/plan/graph';
import { serviceLinks } from '@/application/plan/graph-queries';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Plan, Service } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const mini = async (): Promise<Plan> => loadFixture('mini.yaml');

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`no ${what} in the fixture`);
  return value;
}
const service = (p: Plan, id: string): Service =>
  need(
    p.services.find((s) => s.id === id),
    id,
  );

/** mini.yaml plus a small domain: two stages (place → bill) and two concepts. */
async function withDomain(edit?: (p: Plan) => void): Promise<Plan> {
  const p = await mini();
  service(p, 'svc:subs').does = 'Keeps track of who subscribes';
  p.domain = {
    summary: 'A member places a **subscription**; billing charges it.',
    concepts: [
      {
        id: 'con:subscription',
        name: 'Subscription',
        terms: ['sub'],
        means: 'A paid plan a member holds. It renews monthly.',
        born_in: 'svc:subs',
        aka: [
          { in: 'svc:subs', as: 'Subscription', at: 'sch:subscription' },
          { in: 'svc:billing', as: 'Invoice line', at: 'sch:invoice' },
        ],
      },
      {
        id: 'con:invoice',
        name: 'Invoice',
        means: 'What billing charges.',
        part_of: 'con:subscription',
        relates: [{ to: 'con:subscription', as: 'bills' }],
      },
    ],
    stages: [
      {
        id: 'stage:place',
        name: 'Place',
        summary: 'Members sign up and cancel.',
        services: [{ svc: 'svc:web' }, { svc: 'svc:subs' }],
      },
      {
        id: 'stage:bill',
        name: 'Bill',
        services: [{ svc: 'svc:billing' }, { svc: 'svc:analytics', from: ['st:billing-db'] }],
        flows: ['flow:billing-run'],
      },
    ],
  };
  edit?.(p);
  return p;
}
const errorsAt = (p: Plan, path: string) => validatePlan(p).errors.filter((e) => e.path === path);

describe('domain', () => {
  it('validates clean and indexes concepts and stages', async () => {
    const p = await withDomain();
    expect(validatePlan(p).errors).toEqual([]);
    const m = derive(p);
    expect(m.domain().concepts).toHaveLength(2);
    expect(m.domain().stageIndex('stage:bill')).toBe(1);
  });
  it('makes dangling concept and stage refs errors', async () => {
    const p = await withDomain((x) => {
      const [, second] = x.domain?.concepts ?? [];
      if (second) second.part_of = 'con:nope';
      const first = x.domain?.stages?.[0]?.services?.[0];
      if (first) first.svc = 'svc:ghost';
    });
    expect(errorsAt(p, 'domain.concepts[1].part_of')).toHaveLength(1);
    expect(errorsAt(p, 'domain.stages[0].services[0].svc')).toHaveLength(1);
  });
  it('authors the stage of services and listed flows, else the majority actor', async () => {
    const d = derive(await withDomain()).domain();
    expect(d.stageOf('svc:billing')).toBe('stage:bill');
    expect(d.stageOf('flow:billing-run')).toBe('stage:bill');
    expect(d.stageOf('flow:cancel')).toBe('stage:place');
    expect(d.stageOf('flow:cancel#request')).toBe('stage:place');
    expect(d.stageOf('sch:subscription')).toBe('stage:place');
    expect(d.stageOf('nope:x')).toBeNull();
    expect(d.roleOf('svc:subs')).toBe('Keeps track of who subscribes');
    expect(d.relatedTo('con:subscription').map((c) => c.id)).toEqual(['con:invoice']);
    expect(d.flowsIn('stage:bill')).toEqual(['flow:billing-run']);
  });
  it('links stages by events, topic access and authored `from`, earlier stage first', async () => {
    const links = derive(await withDomain()).domainLinks('asIs');
    const byKey = new Map(links.map((l) => [`${l.from}>${l.to}`, l]));
    expect(byKey.get('svc:subs>svc:billing')?.kinds).toEqual(['msg']);
    expect(byKey.get('svc:subs>svc:billing')?.via).toContain('st:sub-events');
    expect(byKey.has('svc:billing>svc:analytics')).toBe(true);
    expect(byKey.get('svc:billing>svc:analytics')?.same).toBe(true);
    expect(byKey.has('svc:web>svc:subs')).toBe(true);
  });
  it('puts concept terms first in the glossary and points them at the concept', async () => {
    const g = derive(await withDomain()).glossaryTerms();
    const t = g.terms.find((x) => x.term === 'Subscriptions');
    expect(t?.ref).toBe('con:subscription');
    expect(t?.means).toBe('A paid plan a member holds.');
    expect(g.terms.some((x) => x.term === 'sub' && x.ref === 'con:subscription')).toBe(true);
  });
  it('changes nothing without a domain', async () => {
    const m = derive(await mini());
    expect(m.domain().stages).toEqual([]);
    expect(m.domainLinks('asIs')).toEqual([]);
  });
});

/** withDomain plus a Subscriptions system: the API and a worker that shares its database. */
async function withSystem(edit?: (p: Plan) => void): Promise<Plan> {
  return withDomain((p) => {
    Object.assign(p, {
      systems: [
        {
          id: 'sys:subs',
          name: 'Subscriptions system',
          team: 'team:subs',
          does: 'Holds subscriptions',
          sources: [
            {
              url: 'https://github.com/o/subs/blob/0123456789abcdef0123456789abcdef01234567/README.md#L1',
            },
          ],
        },
      ],
    });
    Object.assign(p, {
      services: [
        ...p.services,
        { id: 'svc:subs-worker', name: 'Subs worker', team: 'team:subs', kind: 'job' },
      ],
    });
    for (const s of p.services)
      if (s.id === 'svc:subs' || s.id === 'svc:subs-worker') s.system = 'sys:subs';
    const db = need(
      p.stores?.find((s) => s.id === 'st:subs-db'),
      'st:subs-db',
    );
    db.access = [{ svc: 'svc:subs-worker', mode: 'readwrite' }];
    p.domain?.stages?.[0]?.services?.push({ svc: 'svc:subs-worker' });
    edit?.(p);
  });
}
const key = (l: { from: string; to: string }) => `${l.from}>${l.to}`;
const warnsOn = (p: Plan, re: RegExp) => validatePlan(p).warnings.filter((w) => re.test(w.message));

const lonely = async (edit?: (p: Plan) => void) =>
  withDomain((p) => {
    Object.assign(p, {
      services: [
        ...p.services,
        { id: 'svc:tax', name: 'Tax', team: 'team:billing', kind: 'service' },
      ],
    });
    p.domain?.stages?.[1]?.services?.push({ svc: 'svc:tax' });
    edit?.(p);
  });

describe('domain links from authored `from`', () => {
  it('links services, interfaces and endpoints to the stage service that reads them', async () => {
    const p = await withDomain((x) => {
      const bill = x.domain?.stages?.[1]?.services;
      bill?.push(
        { svc: 'svc:billing', from: ['svc:subs'] },
        {
          svc: 'svc:analytics',
          from: ['if:subs-rest', 'api:subs-cancel', 'st:sub-events'],
        },
      );
    });
    const links = derive(p).domainLinks('asIs');
    const found = new Map(links.map((l) => [key(l), l]));
    expect(found.get('svc:subs>svc:billing')?.kinds).toEqual(expect.arrayContaining(['api']));
    expect(found.get('svc:subs>svc:analytics')?.via).toEqual(
      expect.arrayContaining(['if:subs-rest', 'st:sub-events']),
    );
  });
  it('links the writers and readers of a queue', async () => {
    const p = await withDomain((x) => {
      Object.assign(x, {
        stores: [
          ...(x.stores ?? []),
          {
            id: 'st:jobs',
            name: 'jobs',
            kind: 'queue',
            owner: 'svc:subs',
            access: [
              { svc: 'svc:billing', mode: 'read' },
              { svc: 'svc:subs', mode: 'readwrite' },
            ],
          },
        ],
      });
    });
    const link = derive(p)
      .domainLinks('asIs')
      .find((l) => l.from === 'svc:subs' && l.to === 'svc:billing');
    expect(link?.via).toContain('st:jobs');
  });
  it('places a flow of no authored stage by its majority actor, tie to the earlier stage', async () => {
    const p = await withDomain((x) => {
      const stage = x.domain?.stages?.[1];
      if (stage) delete stage.flows;
    });
    const d = derive(p).domain();
    expect(d.stageOf('flow:billing-run')).toBe('stage:bill');
    expect(d.flowsIn('stage:bill', 'toBe')).toContain('flow:billing-run');
    expect(d.stageIndex('stage:none')).toBe(-1);
  });
});

describe('systems', () => {
  it('validates clean for a system of two services of one team in one stage', async () => {
    const { errors, warnings } = validatePlan(await withSystem());
    expect(errors).toEqual([]);
    expect(warnings.filter((w) => w.message.includes('sys:subs'))).toEqual([]);
  });
  it('spans one team, two or more services and one stage', async () => {
    const cross = validatePlan(
      await withSystem((p) => {
        service(p, 'svc:web').system = 'sys:subs';
      }),
    );
    expect(cross.errors.some((e) => e.message.includes('a system belongs to one team'))).toBe(true);
    const one = await withSystem((p) => {
      delete service(p, 'svc:subs-worker').system;
    });
    expect(warnsOn(one, /has only one service/)).toHaveLength(1);
    const split = await withSystem((p) => {
      p.domain?.stages?.[0]?.services?.pop();
      p.domain?.stages?.[1]?.services?.push({ svc: 'svc:subs-worker' });
    });
    expect(warnsOn(split, /sit in different stages/)).toHaveLength(1);
    const bare = await withSystem((p) => {
      Reflect.deleteProperty(p.systems![0]!, 'sources');
    });
    expect(warnsOn(bare, /link the code that makes them one system/)).toHaveLength(1);
  });
  it('warns for a service with no line, and counts a via: internal step to it as a call', async () => {
    expect(warnsOn(await lonely(), /svc:tax has no line on the system map/)).toHaveLength(1);
    const called = await lonely((p) => {
      p.flows?.[1]?.steps.push({
        id: 'flow:billing-run#tax',
        from: 'svc:billing',
        to: 'svc:tax',
        via: 'internal',
        action: 'Work out tax',
      });
    });
    expect(warnsOn(called, /svc:tax has no line/)).toHaveLength(0);
    const links = serviceLinks(buildGraph(systemOf(called)), called.domain?.stages);
    expect(
      links.some(
        (l) => l.from === 'svc:tax' && l.to === 'svc:billing' && l.kind === 'api' && l.via === null,
      ),
    ).toBe(true);
  });
  it('lets a declared consumer no flow walks yet still listen', async () => {
    const p = await mini();
    const flow = need(p.flows?.[0], 'first flow');
    flow.steps = flow.steps.filter((s) => s.id !== 'flow:cancel#to-analytics');
    const m = derive(p);
    expect(
      m
        .consumersEffective('msg:status-changed-v1', 'asIs')
        .map((c) => c.svc)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['svc:analytics', 'svc:billing']);
    expect(
      m.edges('asIs', 'msg').some((e) => e.from === 'st:sub-events' && e.to === 'svc:analytics'),
    ).toBe(true);
  });
});

describe('glossary', () => {
  it('matches the plan’s own terms in running text and looks them up', async () => {
    const g = derive(await mini()).glossaryTerms();
    expect(
      [...'We dual-publish via the Outbox.'.matchAll(g.regex ?? /^$/g)].map((x) => x[0]),
    ).toEqual(['dual-publish', 'Outbox']);
    expect(g.lookup('OUTBOX')).toMatch(/same transaction/);
    expect(g.lookup('nothing')).toBeNull();
  });
  it('explains an acronym-named service and leaves names that contain a concept word whole', async () => {
    const p = await withDomain((x) => {
      Object.assign(x, {
        services: [
          ...x.services,
          {
            id: 'svc:wms',
            name: 'WMS',
            team: 'team:billing',
            kind: 'service',
            does: 'Runs the warehouse. Quietly.',
          },
          { id: 'svc:subs-api', name: 'Subscription API', team: 'team:subs', kind: 'service' },
        ],
      });
    });
    const g = derive(p).glossaryTerms();
    expect(g.terms.find((t) => t.term === 'WMS')?.means).toBe('Runs the warehouse.');
    expect(g.block).toContain('Subscription API');
  });
  it('has no matcher without terms', async () => {
    const p = await mini();
    delete p.problem.glossary;
    const g = derive(p).glossaryTerms();
    expect(g.regex).toBeNull();
    expect(g.lookup('x')).toBeNull();
  });
});
