import { beforeEach, describe, expect, it } from 'vitest';

import {
  careInput,
  FINANCING,
  inputOf,
  LISTING,
  ORDER_CHANGE,
  OVERLAP,
  PROGRAMME,
  STACKED_BASE,
  TEAMS,
} from '@/../test/fixtures/plan-index';
import { NO_BASE } from '@/application/plan/plan-base';
import type { Overlap } from '@/application/plan/plan-stack';

import {
  isHeldUp,
  workDone,
  type WorkspacePlanIndex,
  workspacePlanIndexOf,
} from './workspace-plan-index';

function workAt(index: WorkspacePlanIndex, key: string) {
  const found = index.work.get(key);
  if (found === undefined) throw new Error(key);
  return found;
}

describe('workspacePlanIndexOf', () => {
  let index: WorkspacePlanIndex;
  beforeEach(() => {
    index = workspacePlanIndexOf(careInput());
  });

  it('orders every plan after the plans it builds on, names first otherwise', () => {
    expect([...index.plans.keys()]).toEqual(['financing', 'listing', 'order-change']);
    expect(index.plans.get('order-change')).toMatchObject({
      title: 'Change an order',
      href: '/acme/plans/order-change/',
      programme: 'care',
      buildsOn: ['financing'],
      landed: false,
      checkedOn: '2026-10-25',
      stale: false,
      order: 2,
      work: ['order-change/wi:quote', 'order-change/wi:revise'],
    });
    expect(index.plans.get('listing')?.programme).toBeNull();
  });

  it('gathers a programme’s plans in landing order', () => {
    expect(index.programmes.get('care')).toEqual({
      id: 'care',
      title: 'Care in Sweden',
      outcome: 'One Care deal from sale to change.',
      href: '/acme/programmes/care/',
      plans: ['financing', 'order-change'],
      milestones: PROGRAMME.milestones,
      decisions: PROGRAMME.decisions,
      questions: PROGRAMME.questions,
    });
  });

  it('keys changes by plan, with the systems each touches', () => {
    expect(index.changes.get('financing/chg:status-api')).toEqual({
      key: 'financing/chg:status-api',
      plan: 'financing',
      id: 'chg:status-api',
      title: 'A status API',
      href: '/acme/plans/financing/things/?id=chg-status-api',
      realisation: null,
      systems: ['sys:finance'],
    });
    expect(index.changes.get('financing/chg:events')?.systems).toEqual(['sys:finance']);
    expect(index.changes.get('order-change/chg:revision')?.systems).toEqual(['sys:revisions']);
    expect(index.changes.get('order-change/chg:quote')?.systems).toEqual(['sys:finance']);
  });

  it('finds the system of what an earlier plan adds, and of what is added into a thing of today', () => {
    const adds: typeof FINANCING = {
      ...FINANCING,
      meta: { id: 'adds', title: 'Adds' },
      changes: [
        {
          id: 'chg:new-api',
          title: 'A new endpoint on the status service',
          ops: [
            { add: 'endpoint', into: 'svc:status#api', value: { id: 'api:new', sig: 'GET /new' } },
            { add: 'field', into: 'sch:nowhere', value: { name: 'loose', type: 'string' } },
            { add: 'note', value: 'not a record' } as never,
          ],
        },
      ],
      work_items: [],
      milestones: [],
    };
    const reads: typeof FINANCING = {
      ...FINANCING,
      meta: { id: 'reads', title: 'Reads' },
      builds_on: ['adds'],
      changes: [
        {
          id: 'chg:tune',
          title: 'Tune the new endpoint',
          ops: [{ modify: 'api:new', set: { sig: 'GET /newer' } }],
        },
      ],
      work_items: [],
      milestones: [],
    };
    const both = workspacePlanIndexOf({
      ...careInput(),
      plans: [inputOf('reads', reads), inputOf('adds', adds)],
    });
    expect(both.changes.get('adds/chg:new-api')?.systems).toEqual(['sys:finance']);
    expect(both.changes.get('reads/chg:tune')?.systems).toEqual(['sys:finance']);
  });

  it('keys work by plan, with what it waits on and builds as keys, and a card', () => {
    const quote = index.work.get('order-change/wi:quote');
    expect(quote).toMatchObject({
      plan: 'order-change',
      dependsOn: ['financing/wi:status'],
      implements: ['order-change/chg:quote'],
      milestone: 'order-change/ms:quote',
    });
    expect(quote?.card.team.partner).toBe(true);
    expect(quote?.card.milestone?.label).toBe('Ziklo can quote');
    expect(quote?.card.dates.gapText).toBe('14 days after we need');
    expect(index.work.get('financing/wi:events')?.dependsOn).toEqual(['financing/wi:status']);
  });

  it('builds an issue link from the repo when the sync gave none', () => {
    expect(index.work.get('financing/wi:status')?.card.issue).toEqual({
      number: 12,
      url: 'https://github.com/acme/finance/issues/12',
      state: null,
    });
    const synced = workspacePlanIndexOf({
      ...careInput(),
      plans: [
        {
          ...inputOf('financing', FINANCING),
          status: { 'wi:status': { state: 'closed', url: 'https://x/12' } },
        },
      ],
    });
    expect(synced.work.get('financing/wi:status')?.card.issue).toEqual({
      number: 12,
      url: 'https://x/12',
      state: 'closed',
    });
  });

  it('reads why a plan builds on another from the ids it uses there and the work it waits on', () => {
    expect(index.dependencies).toEqual([
      {
        from: 'order-change',
        to: 'financing',
        through: ['financing/chg:status-api'],
        health: 'waiting',
      },
    ]);
  });

  it('keeps each overlap once', () => {
    expect(index.overlaps).toEqual([OVERLAP]);
  });

  it('knows its teams, partners and contacts', () => {
    expect(index.teams.get('team:ziklo')?.contacts).toEqual([
      { name: 'Louise A. Zieme', role: 'product' },
    ]);
  });

  it('says done and held up from where the work stands', () => {
    expect(workDone(workAt(index, 'financing/wi:status'))).toBe(true);
    expect(workDone(workAt(index, 'financing/wi:events'))).toBe(false);
    expect(isHeldUp(workAt(index, 'order-change/wi:revise'))).toBe(true);
    expect(isHeldUp(workAt(index, 'order-change/wi:quote'))).toBe(false);
  });
});

const healthOf = (input: ReturnType<typeof careInput>) =>
  workspacePlanIndexOf(input).dependencies.map((d) => d.health);

describe('dependency health', () => {
  it('is ready once the base has landed, or all its work is done', () => {
    const landed = careInput();
    expect(
      healthOf({
        ...landed,
        plans: landed.plans.map((p) =>
          p.slug === 'financing' ? { ...p, base: { ...NO_BASE, mode: 'landed' } } : p,
        ),
      }),
    ).toEqual(['ready']);
    const delivered = careInput();
    expect(
      healthOf({
        ...delivered,
        plans: delivered.plans.map((p) =>
          p.slug === 'financing'
            ? {
                ...p,
                standing: {
                  ...p.standing,
                  work: p.standing.work.map((w) => ({
                    ...w,
                    progress: { state: 'done' as const, at: '2026-11-01', source: null },
                  })),
                },
              }
            : p,
        ),
      }),
    ).toEqual(['ready']);
  });

  it('is stale when the base changed since the plan was checked', () => {
    const base = {
      ...STACKED_BASE,
      stale: true,
      builtOn: [{ slug: 'financing', title: 'Financing status', changed: true }],
    };
    expect(healthOf(careInput({ orderBase: base }))).toEqual(['stale']);
  });

  it('is a conflict when two plans it reads overlap', () => {
    const both = { ...ORDER_CHANGE, builds_on: ['financing', 'listing'] };
    const clash = { ...OVERLAP, plans: ['financing', 'listing'] as const };
    const input = {
      workspace: 'acme',
      plans: [
        inputOf('order-change', both, { base: STACKED_BASE }),
        inputOf('financing', FINANCING, { overlaps: [clash] }),
        inputOf('listing', LISTING, { overlaps: [clash] }),
      ],
      programmes: [PROGRAMME],
      teams: TEAMS,
    };
    expect(healthOf(input)).toEqual(['conflict', 'conflict']);
  });

  it('skips a base the workspace does not have, and plans in a circle keep name order', () => {
    const circle = [
      inputOf('b', { ...LISTING, builds_on: ['a', 'missing'] }),
      inputOf('a', { ...LISTING, builds_on: ['b'] }),
    ];
    const index = workspacePlanIndexOf({
      workspace: 'acme',
      plans: circle,
      programmes: [],
      teams: TEAMS,
    });
    expect([...index.plans.keys()]).toEqual(['b', 'a']);
    expect(index.dependencies.map((d) => `${d.from}>${d.to}`)).toEqual(['b>a', 'a>b']);
    expect(index.changes.get('a/chg:status-copy')?.systems).toEqual([]);
  });
});

const bare = (id: string, more: Partial<typeof LISTING>): typeof LISTING => ({
  meta: { id, title: id },
  problem: { summary: '' },
  teams: LISTING.teams,
  services: [],
  ...more,
});

const indexOf = (plans: ReturnType<typeof inputOf>[]) =>
  workspacePlanIndexOf({
    workspace: 'acme',
    plans,
    programmes: [],
    teams: TEAMS,
    systemsOf: (id) => (id === 'svc:status' ? ['sys:finance'] : []),
  });

describe('what the index reads closely', () => {
  it('reads through the ids a plan uses, a part’s root, and the work it waits on, in order', () => {
    const base = bare('b', {
      changes: [
        { id: 'chg:z-root', title: 'Z', ops: [{ modify: 'sch:o#f', set: { type: 'x' } }] },
        { id: 'chg:a-work', title: 'A', ops: [{ modify: 'svc:y', set: { summary: 'y' } }] },
        { id: 'chg:m-other', title: 'M', ops: [{ modify: 'svc:q', set: { summary: 'q' } }] },
      ],
      work_items: [
        { id: 'wi:b', title: 'B', team: 'team:orders', implements: ['chg:a-work'] },
        { id: 'wi:c', title: 'C', team: 'team:orders', implements: ['chg:m-other'] },
      ],
    });
    const plan = bare('p', {
      builds_on: ['b'],
      changes: [{ id: 'chg:p', title: 'P', ops: [{ modify: 'sch:o', set: { summary: 'o' } }] }],
      work_items: [
        { id: 'wi:p', title: 'P', team: 'team:orders', depends_on: ['b/wi:b', 'z/wi:c'] },
      ],
    });
    const index = indexOf([inputOf('p', plan), inputOf('b', base)]);
    expect(index.dependencies[0]?.through).toEqual(['b/chg:a-work', 'b/chg:z-root']);
    expect(index.plans.get('b')?.buildsOn).toEqual([]);
    expect(index.plans.get('b')?.milestones).toEqual([]);
    expect(index.plans.get('p')?.work).toEqual(['p/wi:p']);
    expect(index.work.get('b/wi:b')?.dependsOn).toEqual([]);
    expect(index.dependencies[0]?.health).toBe('waiting');
  });

  it('finds the system of a change from a system it adds, a component’s system, or today', () => {
    const plan = bare('s', {
      changes: [
        {
          id: 'chg:s',
          title: 'S',
          ops: [
            { add: 'system', value: { id: 'sys:new', name: 'New' } },
            {
              add: 'service',
              value: { id: 'svc:n', name: 'N', kind: 'service', system: 'sys:held' },
            },
            { add: 'service', value: { id: 'svc:status', name: 'Again', kind: 'service' } },
            { modify: 'sys:moved', set: { name: 'Moved' } },
            { deprecate: 7 } as never,
            { add: 'system', value: { name: 'No id' } } as never,
            { add: 'service', value: { id: 9, system: 9 } } as never,
          ],
        },
      ],
    });
    expect(indexOf([inputOf('s', plan)]).changes.get('s/chg:s')?.systems).toEqual([
      'sys:finance',
      'sys:held',
      'sys:moved',
      'sys:new',
    ]);
  });

  it('keeps global flow participation separate from an exact nested step target', () => {
    const plan = bare('flow', {
      changes: [
        {
          id: 'chg:flow',
          title: 'Whole flow',
          ops: [{ modify: 'flow:mixed', set: { outcome: 'Confirmed' } }],
        },
        {
          id: 'chg:step',
          title: 'One step',
          ops: [{ modify: 'flow:mixed#save', set: { action: 'Save' } }],
        },
      ],
    });
    const participants: Readonly<Record<string, readonly string[]>> = {
      'flow:mixed': ['sys:two', 'sys:one', 'sys:two'],
      'flow:mixed#save': ['sys:two'],
    };
    const index = workspacePlanIndexOf({
      ...careInput(),
      plans: [inputOf('flow', plan)],
      systemsOf: (id) => participants[id] ?? [],
    });
    expect(index.changes.get('flow/chg:flow')?.systems).toEqual(['sys:one', 'sys:two']);
    expect(index.changes.get('flow/chg:step')?.systems).toEqual(['sys:two']);
  });

  it('only builds an issue link from a repo with an owner and an issue', () => {
    const plan = bare('i', {
      work_items: [
        { id: 'wi:no-repo', title: 'A', team: 'team:orders', github_issue: 1 },
        { id: 'wi:no-issue', title: 'B', team: 'team:orders', repo: 'acme/x' },
        { id: 'wi:bad-repo', title: 'C', team: 'team:orders', repo: 'not a repo', github_issue: 2 },
      ],
    });
    const index = indexOf([inputOf('i', plan)]);
    expect(index.work.get('i/wi:no-repo')?.card.issue).toEqual({
      number: 1,
      url: null,
      state: null,
    });
    expect(index.work.get('i/wi:no-issue')?.card.issue).toBeNull();
    expect(index.work.get('i/wi:bad-repo')?.card.issue?.url).toBeNull();
  });

  it('keeps each change’s realisation, labels a card with its own milestone, and skips unknown work', () => {
    const plan = bare('r', {
      changes: [
        { id: 'chg:one', title: 'One', ops: [] },
        { id: 'chg:two', title: 'Two', ops: [] },
      ],
      milestones: [
        { id: 'ms:first', name: 'First' },
        { id: 'ms:second', name: 'Second' },
      ],
      work_items: [{ id: 'wi:r', title: 'R', team: 'team:orders', milestone: 'ms:second' }],
    });
    const input = inputOf('r', plan);
    const index = indexOf([
      {
        ...input,
        base: { ...input.base, mode: 'landed' },
        standing: {
          ...input.standing,
          work: [
            ...input.standing.work,
            {
              ...input.standing.work[0]!,
              item: { ...input.standing.work[0]!.item, id: 'wi:gone' },
            },
          ],
          changes: [
            { change: 'chg:two', state: 'matches', ops: [] },
            { change: 'chg:one', state: 'partial', ops: [] },
          ],
        },
      },
    ]);
    expect(index.changes.get('r/chg:one')?.realisation).toBe('partial');
    expect(index.changes.get('r/chg:two')?.realisation).toBe('matches');
    expect(index.work.get('r/wi:r')?.card.milestone?.label).toBe('Second');
    expect([...index.work.keys()]).toEqual(['r/wi:r']);
    expect(index.plans.get('r')?.landed).toBe(true);
  });

  it('is held up when the promise was taken back, and links a blocker to its programme', () => {
    const input = careInput();
    const declined = workspacePlanIndexOf({
      ...input,
      plans: input.plans.map((p) => ({
        ...p,
        standing: {
          ...p.standing,
          work: p.standing.work.map((w) =>
            w.item.id === 'wi:listing'
              ? {
                  ...w,
                  blockers: [],
                  commitment: {
                    state: 'declined' as const,
                    promisedFor: null,
                    confidence: null,
                    saidBy: null,
                    at: '2026-11-01',
                    source: null,
                  },
                }
              : w,
          ),
        },
      })),
    });
    expect(isHeldUp(declined.work.get('listing/wi:listing')!)).toBe(true);
  });

  it('keeps each overlap once by its target and changes, in order', () => {
    const second: Overlap = { ...OVERLAP, target: 'svc:a', changes: ['x', 'y\nz'] };
    const third: Overlap = { ...OVERLAP, target: 'svc:a', changes: ['x\ny', 'z'] };
    const index = workspacePlanIndexOf({
      ...careInput(),
      plans: careInput().plans.map((p) =>
        p.slug === 'listing' ? { ...p, overlaps: [OVERLAP, third, second] } : p,
      ),
    });
    expect(index.overlaps.map((o) => o.target)).toEqual(['svc:a', 'svc:status']);
  });

  it('is stale only for the base that changed, and waiting on a base with no work', () => {
    const empty = bare('e', {});
    const other = bare('o', {});
    const plan = bare('p', { builds_on: ['e', 'o'] });
    const input = inputOf('p', plan, {
      base: {
        ...STACKED_BASE,
        builtOn: [
          { slug: 'e', title: 'e', changed: false },
          { slug: 'o', title: 'o', changed: true },
        ],
      },
    });
    const index = indexOf([input, inputOf('e', empty), inputOf('o', other)]);
    expect(index.dependencies.map((d) => [d.to, d.health])).toEqual([
      ['e', 'waiting'],
      ['o', 'stale'],
    ]);
  });

  it('is a conflict only when the plan reads every plan of the overlap', () => {
    const clash = { ...OVERLAP, plans: ['financing', 'listing'] as const };
    const input = {
      workspace: 'acme',
      plans: [
        inputOf('order-change', ORDER_CHANGE, { base: STACKED_BASE }),
        inputOf('financing', FINANCING, { overlaps: [clash] }),
        inputOf('listing', LISTING, { overlaps: [clash] }),
      ],
      programmes: [PROGRAMME],
      teams: TEAMS,
    };
    expect(healthOf(input)).toEqual(['waiting']);
    const deep = {
      ...input,
      plans: [
        inputOf(
          'order-change',
          { ...ORDER_CHANGE, builds_on: ['financing'] },
          { base: STACKED_BASE },
        ),
        inputOf('financing', { ...FINANCING, builds_on: ['listing'] }, { overlaps: [clash] }),
        inputOf('listing', LISTING, { overlaps: [clash] }),
      ],
    };
    expect(healthOf(deep)).toEqual(['waiting', 'conflict']);
  });
});
