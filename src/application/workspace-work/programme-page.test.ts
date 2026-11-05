import { beforeEach, describe, expect, it } from 'vitest';

import { careInput } from '@/../test/fixtures/plan-index';
import type { PlanRow } from '@/application/plan-index';

import { impactVM } from './impact';
import { datesWords } from './milestones';
import {
  HEALTH_WORDS,
  landingOf,
  planStandingWords,
  type PlanStandingVM,
  programmePageVM,
  programmeRowsOf,
} from './programme-page';
import { type WorkspacePlanIndex, workspacePlanIndexOf } from './workspace-plan-index';

let index: WorkspacePlanIndex;

beforeEach(() => {
  index = workspacePlanIndexOf(careInput());
});

describe('programmePageVM', () => {
  let page: ReturnType<typeof programmePageVM>;
  beforeEach(() => {
    page = programmePageVM(index, 'care');
  });

  it('names the programme and says where it stands', () => {
    expect(page?.programme).toEqual({
      id: 'care',
      title: 'Care in Sweden',
      outcome: 'One Care deal from sale to change.',
      href: '/acme/programmes/care/',
    });
    expect(page?.standing).toEqual({
      plans: 2,
      landed: 0,
      blocked: 1,
      nextBlocked: {
        slug: 'order-change',
        title: 'Change an order',
        href: '/acme/plans/order-change/',
      },
      text: '0 of 2 plans landed; Change an order is the next held up.',
    });
  });

  it('lists its plans in landing order, each with what it builds on and how its work stands', () => {
    expect(page?.plans.map((p) => p.slug)).toEqual(['financing', 'order-change']);
    expect(page?.plans[0]).toMatchObject({
      health: 'ready',
      buildsOn: [],
      work: { total: 2, done: 1, blocked: 0 },
      blocked: false,
    });
    expect(page?.plans[1]).toMatchObject({
      health: 'waiting',
      buildsOn: [
        {
          slug: 'financing',
          title: 'Financing status',
          health: 'waiting',
          through: ['financing/chg:status-api'],
        },
      ],
      work: { total: 2, done: 0, blocked: 1 },
      blocked: true,
    });
  });

  it('rolls each programme milestone up from the plan milestones that serve it', () => {
    expect(page?.milestones).toEqual([
      {
        key: 'care/ms:one',
        id: 'ms:one',
        scope: 'care',
        name: 'One deal',
        href: '/acme/programmes/care/',
        neededBy: '2027-02-20',
        promisedFor: '2027-03-01',
        gapDays: 9,
        gapText: '9 days after we need',
        commitment: 'proposed',
        servedBy: [
          {
            slug: 'financing',
            title: 'Financing status',
            href: '/acme/plans/financing/',
            milestone: 'ms:m1',
            name: 'Statuses flow',
          },
          {
            slug: 'order-change',
            title: 'Change an order',
            href: '/acme/plans/order-change/',
            milestone: 'ms:quote',
            name: 'Ziklo can quote',
          },
        ],
      },
    ]);
  });

  it('lists the partner work it depends on, with its gap and the plan it holds up first', () => {
    expect(page?.partnerDependencies).toEqual([
      {
        item: index.work.get('order-change/wi:quote')?.card,
        blocksFirst: {
          slug: 'order-change',
          title: 'Change an order',
          href: '/acme/plans/order-change/',
        },
        gapDays: 14,
        gapText: '14 days after we need',
      },
    ]);
  });

  it('says nothing is held up once nothing is, and is null for an unknown programme', () => {
    expect(programmePageVM(index, 'nope')).toBeNull();
    const calm = careInput();
    const quiet = workspacePlanIndexOf({
      ...calm,
      plans: calm.plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) => ({ ...w, blockers: [] })),
        },
      })),
    });
    expect(programmePageVM(quiet, 'care')?.standing.text).toBe(
      '0 of 2 plans landed; nothing is held up.',
    );
  });
});

describe('programme decisions and questions', () => {
  let page: ReturnType<typeof programmePageVM>;
  beforeEach(() => {
    page = programmePageVM(index, 'care');
  });

  it('lists the decisions and questions it holds, with what is still to settle', () => {
    expect(page?.decisions).toEqual([
      {
        id: 'dec:replace',
        text: 'A revised contract replaces the old one',
        status: 'accepted',
        open: false,
        decideBy: null,
      },
      {
        id: 'dec:reserve',
        text: 'How long a reservation lasts',
        status: 'proposed',
        open: true,
        decideBy: '2026-12-01',
      },
    ]);
    expect(page?.questions).toEqual([
      {
        id: 'q:partial',
        text: 'Who recovers a partial Vista completion after A revised contract replaces the old one?',
        status: 'open',
        open: true,
        decideBy: null,
      },
    ]);
  });

  it('names a cited milestone, and leaves an unknown citation as its id', () => {
    const input = careInput();
    const cited = workspacePlanIndexOf({
      ...input,
      programmes: [
        {
          ...input.programmes[0]!,
          decisions: [],
          questions: [
            {
              id: 'q:when',
              question: 'Is [[ms:one]] before [[care/q:nope]]?',
              status: 'resolved',
              decide_by: '2027-01-01',
            },
          ],
        },
      ],
    });
    expect(programmePageVM(cited, 'care')?.questions).toEqual([
      {
        id: 'q:when',
        text: 'Is One deal before care/q:nope?',
        status: 'resolved',
        open: false,
        decideBy: '2027-01-01',
      },
    ]);
  });
});

describe('programmeRowsOf', () => {
  it('gives each programme as a row with its plan count, how many are held up and the next', () => {
    const input = careInput();
    const two = workspacePlanIndexOf({
      ...input,
      programmes: [...input.programmes, { id: 'aa', title: 'After-sales', outcome: 'Later.' }],
    });
    expect(programmeRowsOf(two)).toEqual([
      {
        id: 'aa',
        title: 'After-sales',
        outcome: 'Later.',
        href: '/acme/programmes/aa/',
        plans: 0,
        blocked: 0,
        nextBlocked: null,
      },
      {
        id: 'care',
        title: 'Care in Sweden',
        outcome: 'One Care deal from sale to change.',
        href: '/acme/programmes/care/',
        plans: 2,
        blocked: 1,
        nextBlocked: {
          slug: 'order-change',
          title: 'Change an order',
          href: '/acme/plans/order-change/',
        },
      },
    ]);
  });
});

describe('planStandingWords', () => {
  const base: PlanStandingVM = {
    slug: 'p',
    title: 'P',
    href: '/p/',
    landed: false,
    stale: false,
    health: 'ready',
    buildsOn: [],
    work: { total: 0, done: 0, blocked: 0 },
    blocked: false,
  };

  it('says how a plan stands, the most pressing first', () => {
    expect(planStandingWords({ ...base, landed: true, blocked: true })).toBe('Landed');
    expect(
      planStandingWords({
        ...base,
        blocked: true,
        health: 'conflict',
        work: { total: 5, done: 1, blocked: 2 },
      }),
    ).toBe('Held up: 2 of 5 work items blocked');
    expect(planStandingWords({ ...base, health: 'conflict', stale: true })).toBe(
      'Two plans it builds on overlap',
    );
    expect(planStandingWords({ ...base, stale: true, health: 'waiting' })).toBe(
      'A plan it builds on changed since it was checked',
    );
    expect(planStandingWords({ ...base, health: 'stale' })).toBe(
      'A plan it builds on changed since it was checked',
    );
    expect(planStandingWords({ ...base, health: 'waiting' })).toBe(
      'Waiting for the plans it builds on',
    );
    expect(planStandingWords({ ...base, work: { total: 2, done: 2, blocked: 0 } })).toBe(
      'Work done',
    );
    expect(planStandingWords({ ...base, work: { total: 2, done: 1, blocked: 0 } })).toBe('Ready');
    expect(planStandingWords(base)).toBe('Ready');
  });

  it('words each health of a plan built on', () => {
    expect(HEALTH_WORDS).toEqual({
      ready: 'delivered',
      waiting: 'work still to do',
      stale: 'changed since checked',
      conflict: 'overlaps another plan it builds on',
    });
  });
});

const row = (id: string, domains: readonly string[]): PlanRow => ({
  id,
  title: id,
  href: `/acme/plans/${id}/`,
  summary: '',
  stage: 'draft',
  date: null,
  domains,
  workItems: 0,
  done: 0,
  programme: null,
  check: null,
});

describe('landingOf', () => {
  it('counts the programme’s plans in each domain, most first, leaving out domains none reach', () => {
    const rows = [
      row('financing', ['sales']),
      row('order-change', ['sales', 'orders']),
      row('listing', ['web', 'orders']),
    ];
    const domains = [
      { id: 'web', name: 'Web' },
      { id: 'orders', name: 'Orders' },
      { id: 'sales', name: 'Sales' },
    ];
    expect(landingOf('acme', ['financing', 'order-change'], rows, domains)).toEqual([
      { id: 'sales', name: 'Sales', href: '/acme/sales/', plans: 2 },
      { id: 'orders', name: 'Orders', href: '/acme/orders/', plans: 1 },
    ]);
  });
});

describe('datesWords', () => {
  it('puts the need, the promise and the gap in one line', () => {
    const today = new Date('2027-01-10T12:00:00Z');
    expect(
      datesWords(
        { neededBy: '2027-02-15', promisedFor: '2027-03-01', gapText: '14 days after we need' },
        today,
      ),
    ).toBe('needed by 15 Feb · promised for 1 Mar · 14 days after we need');
    expect(datesWords({ neededBy: null, promisedFor: null, gapText: null })).toBe(
      'no date needed · nothing promised',
    );
  });
});

describe('impactVM', () => {
  it('puts a team’s pending work in the order it can happen, held-up work apart', () => {
    const impact = impactVM(index, { kind: 'team', id: 'team:orders' });
    expect(impact?.subject).toEqual({
      kind: 'team',
      id: 'team:orders',
      name: 'Orders',
      partner: false,
    });
    expect(impact?.groups.map((g) => [g.state, g.items.map((c) => c.key)])).toEqual([
      ['now', ['financing/wi:events', 'listing/wi:listing']],
      ['blocked', ['order-change/wi:revise']],
    ]);
  });

  it('counts the waves of unfinished work before each item', () => {
    const impact = impactVM(index, { kind: 'team', id: 'team:ziklo' });
    expect(impact?.subject).toMatchObject({ name: 'Ziklo', partner: true });
    expect(impact?.groups.map((g) => [g.state, g.items.map((c) => c.key)])).toEqual([
      ['now', ['order-change/wi:quote']],
    ]);
    const unblocked = careInput();
    const free = workspacePlanIndexOf({
      ...unblocked,
      plans: unblocked.plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) => ({ ...w, blockers: [] })),
        },
      })),
    });
    expect(
      impactVM(free, { kind: 'team', id: 'team:orders' })?.groups.map((g) => [
        g.state,
        g.items.map((c) => c.key),
      ]),
    ).toEqual([
      ['now', ['financing/wi:events', 'listing/wi:listing']],
      ['next', ['order-change/wi:revise']],
    ]);
  });

  it('finds the work on a system through the changes it builds', () => {
    const impact = impactVM(index, { kind: 'system', id: 'sys:finance', name: 'Finance' });
    expect(impact?.subject).toEqual({ kind: 'system', id: 'sys:finance', name: 'Finance' });
    expect(impact?.groups.flatMap((g) => g.items.map((c) => c.key))).toEqual([
      'financing/wi:events',
      'listing/wi:listing',
      'order-change/wi:quote',
    ]);
  });

  it('is null for an unknown team, and puts work three waves deep under then', () => {
    expect(impactVM(index, { kind: 'team', id: 'team:nobody' })).toBeNull();
    const deep = careInput();
    const chained = workspacePlanIndexOf({
      ...deep,
      plans: deep.plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) => ({ ...w, blockers: [], progress: null })),
        },
      })),
    });
    const groups = impactVM(chained, { kind: 'team', id: 'team:orders' })?.groups ?? [];
    expect(groups.map((g) => [g.state, g.items.map((c) => c.key)])).toEqual([
      ['now', ['financing/wi:status', 'listing/wi:listing']],
      ['next', ['financing/wi:events']],
      ['then', ['order-change/wi:revise']],
    ]);
  });
});
