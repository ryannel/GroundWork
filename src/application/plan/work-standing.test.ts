import { describe, expect, it } from 'vitest';

import {
  commitmentsOf,
  gapDays,
  lastHeardOf,
  rollUpCommitment,
  standingOf,
  type StandingContext,
} from '@/application/plan/work-standing';
import type { ProgressEvent } from '@/domain/model/plan.generated';
import type { Plan } from '@/domain/plan/plan.generated';

const plan: Plan = {
  meta: { id: 'order-change', title: 'Order change' },
  problem: { summary: 'Orders cannot change.' },
  teams: [
    { id: 'team:orders', name: 'Orders' },
    { id: 'team:ziklo', name: 'Ziklo (plan)' },
  ],
  services: [],
  milestones: [
    { id: 'ms:quote', name: 'Ziklo can quote', due: '2027-02-28' },
    { id: 'ms:revise', name: 'Revise an order', after: ['ms:quote', 'care-financing/ms:status'] },
    { id: 'ms:empty', name: 'Nothing in it yet' },
  ],
  work_items: [
    {
      id: 'wi:quote',
      title: 'Provide the quote',
      team: 'team:ziklo',
      milestone: 'ms:quote',
      needed_by: '2027-02-15',
    },
    { id: 'wi:lookup', title: 'Look up an order', team: 'team:ziklo', milestone: 'ms:quote' },
    {
      id: 'wi:checkout',
      title: 'Checkout revision',
      team: 'team:orders',
      milestone: 'ms:revise',
      github_issue: 41,
      depends_on: ['wi:quote', 'care-financing/wi:correlate', 'care-financing/wi:fine'],
      blocked_by: ['q:shape', 'dec:contract', 'care-se/dec:replaces', 'q:answered', 'dec:taken'],
    },
    { id: 'wi:unknown-team', title: 'Someone else', team: 'team:elsewhere' },
  ],
  questions: [
    { id: 'q:shape', question: 'What shape is the quote?', status: 'open' },
    {
      id: 'q:answered',
      question: 'Already answered?',
      status: 'open',
      answered_by: 'dec:taken',
    },
  ],
  decisions: [
    { id: 'dec:contract', title: 'Replace the contract', status: 'proposed' },
    { id: 'dec:taken', title: 'Taken', status: 'accepted' },
  ],
};

const context: StandingContext = {
  teams: [
    { id: 'team:orders', name: 'Orders', partner: false },
    { id: 'team:ziklo', name: 'Ziklo', partner: true },
  ],
  elsewhere: {
    commitments: {
      'care-financing/wi:correlate': 'withdrawn',
      'care-financing/wi:fine': 'accepted',
      'care-financing/ms:status': 'declined',
    },
    statuses: { 'care-se/dec:replaces': 'deferred' },
    labels: { 'care-financing/wi:correlate': 'Correlate the events' },
  },
};

const at = (day: string, over: Partial<ProgressEvent>): ProgressEvent => ({
  at: day,
  subject: 'wi:quote',
  kind: 'note',
  ...over,
});

const events: ProgressEvent[] = [
  at('2026-10-20', {
    kind: 'commitment',
    state: 'proposed',
    said_by: 'Louise',
    source: { kind: 'meeting', url: 'https://notion.test/1' },
  }),
  at('2026-11-02', {
    kind: 'commitment',
    state: 'accepted',
    promised_for: '2027-03-01',
    confidence: 'medium',
    said_by: 'Henrik',
    source: { kind: 'partner-update' },
  }),
  at('2026-11-03', { kind: 'work', state: 'in_progress' }),
  at('2026-11-04', { kind: 'note', said_by: 'Louise', note: 'Demoed.' }),
  at('2026-11-01', { subject: 'wi:lookup', kind: 'commitment', state: 'declined' }),
  at('2026-11-05', {
    subject: 'wi:checkout',
    kind: 'work',
    state: 'done',
    source: { kind: 'github', repo: 'org/checkout', issue: 41 },
  }),
  at('2026-10-01', { subject: 'ms:revise', kind: 'commitment', state: 'accepted' }),
];

// Worked out inside each test, so mutation testing can tell which test covers which line.
const standing = () => standingOf(plan, { events }, context);
const item = (id: string) => standing().work.find((w) => w.item.id === id);
const milestone = (id: string) => standing().milestones.find((m) => m.milestone.id === id);

describe('gapDays', () => {
  it('is promised minus needed: positive when the promise is later than the need', () => {
    expect(gapDays('2027-03-01', '2027-02-15')).toBe(14);
    expect(gapDays('2027-02-10', '2027-02-15')).toBe(-5);
    expect(gapDays('2027-02-15', '2027-02-15')).toBe(0);
  });

  it('counts calendar days across months and leap years, reading the day of a date-time', () => {
    expect(gapDays('2028-03-01T09:00:00Z', '2028-02-28')).toBe(2);
    expect(gapDays('2027-01-01', '2026-12-31')).toBe(1);
  });

  it('is null without both dates, or with one that is no date', () => {
    expect(gapDays(null, '2027-02-15')).toBeNull();
    expect(gapDays('2027-02-15', null)).toBeNull();
    expect(gapDays('soon', '2027-02-15')).toBeNull();
  });
});

describe('a work item’s standing', () => {
  it('reads its commitment from the latest commitment event, with who said it and where', () => {
    expect(item('wi:quote')?.commitment).toEqual({
      state: 'accepted',
      promisedFor: '2027-03-01',
      confidence: 'medium',
      saidBy: 'Henrik',
      at: '2026-11-02',
      source: { kind: 'partner-update', url: null, repo: null, issue: null, note: null },
    });
  });

  it('reads its progress from the latest work event, GitHub’s included', () => {
    expect(item('wi:quote')?.progress).toEqual({
      state: 'in_progress',
      at: '2026-11-03',
      source: null,
    });
    expect(item('wi:checkout')?.progress).toEqual({
      state: 'done',
      at: '2026-11-05',
      source: {
        kind: 'github',
        url: 'https://github.com/org/checkout/issues/41',
        repo: 'org/checkout',
        issue: 41,
        note: null,
      },
    });
  });

  it('hears last from the newest event of any kind', () => {
    expect(item('wi:quote')?.lastHeard).toEqual({
      at: '2026-11-04',
      by: 'Louise',
      sourceKind: null,
      url: null,
    });
    expect(item('wi:unknown-team')?.lastHeard).toBeNull();
    expect(item('wi:unknown-team')?.commitment).toBeNull();
    expect(item('wi:unknown-team')?.progress).toBeNull();
  });

  it('keeps our need and their promise apart, with the gap between them', () => {
    expect(item('wi:quote')?.dates).toEqual({
      neededBy: '2027-02-15',
      promisedFor: '2027-03-01',
      gapDays: 14,
    });
  });

  it('falls back to its milestone’s due date for when it is needed', () => {
    expect(item('wi:lookup')?.dates).toEqual({
      neededBy: '2027-02-28',
      promisedFor: null,
      gapDays: null,
    });
  });

  it('takes its team from the workspace, partner flag included, else from the plan', () => {
    expect(item('wi:quote')?.team).toEqual({ id: 'team:ziklo', name: 'Ziklo', partner: true });
    expect(item('wi:checkout')?.team).toEqual({
      id: 'team:orders',
      name: 'Orders',
      partner: false,
    });
    expect(item('wi:unknown-team')?.team).toEqual({
      id: 'team:elsewhere',
      name: 'team:elsewhere',
      partner: false,
    });
    expect(item('wi:checkout')?.item).toEqual({
      id: 'wi:checkout',
      title: 'Checkout revision',
      milestone: 'ms:revise',
      issue: 41,
    });
  });

  it('is blocked by declined or withdrawn dependencies here or in another plan, and by open gates', () => {
    expect(item('wi:checkout')?.blockers).toEqual([
      {
        kind: 'depends-on',
        id: 'care-financing/wi:correlate',
        label: 'Correlate the events',
        state: 'withdrawn',
      },
      { kind: 'question', id: 'q:shape', label: 'What shape is the quote?', state: 'open' },
      { kind: 'decision', id: 'dec:contract', label: 'Replace the contract', state: 'proposed' },
      {
        kind: 'decision',
        id: 'care-se/dec:replaces',
        label: 'care-se/dec:replaces',
        state: 'deferred',
      },
    ]);
    expect(item('wi:quote')?.blockers).toEqual([]);
  });

  it('is blocked by a declined dependency in its own plan', () => {
    const depends = standingOf(
      {
        ...plan,
        work_items: [
          { id: 'wi:lookup', title: 'Look up', team: 'team:ziklo' },
          { id: 'wi:after', title: 'After', team: 'team:orders', depends_on: ['wi:lookup'] },
        ],
      },
      { events },
      context,
    );
    expect(depends.work[1]?.blockers).toEqual([
      { kind: 'depends-on', id: 'wi:lookup', label: 'Look up', state: 'declined' },
    ]);
  });

  it('reads nothing elsewhere without the plans beside it', () => {
    const alone = standingOf(plan, { events }, { teams: [] });
    expect(alone.work.find((w) => w.item.id === 'wi:checkout')?.blockers.map((b) => b.id)).toEqual([
      'q:shape',
      'dec:contract',
    ]);
  });
});

describe('what standing reads from the record', () => {
  it('ignores events whose kind or state does not fit, and names a plan team the workspace lacks', () => {
    const odd = standingOf(
      { ...plan, milestones: [{ id: 'ms:quote', name: 'Quote', serves: 'care-se/ms:m3' }] },
      {
        events: [
          at('2026-11-01', { kind: 'note', state: 'accepted' }),
          at('2026-11-02', { kind: 'work', state: 'declined' }),
          at('2026-11-03', { kind: 'commitment', state: 'done' }),
          at('2026-11-04', { kind: 'note' }),
        ],
      },
      { teams: [] },
    );
    const [quote] = odd.work;
    expect(quote?.commitment).toBeNull();
    expect(quote?.progress).toBeNull();
    expect(quote?.lastHeard?.at).toBe('2026-11-04');
    expect(quote?.team).toEqual({ id: 'team:ziklo', name: 'Ziklo (plan)', partner: false });
    expect(odd.milestones[0]?.milestone).toEqual({
      id: 'ms:quote',
      name: 'Quote',
      serves: 'care-se/ms:m3',
    });
  });

  it('is blocked by nothing it cannot find, and by an open question whose answer is still proposed', () => {
    const gated = standingOf(
      {
        ...plan,
        questions: [
          { id: 'q:pending', question: 'Pending?', status: 'open', answered_by: 'dec:x' },
        ],
        decisions: [{ id: 'dec:x', title: 'X', status: 'proposed' }],
        work_items: [
          {
            id: 'wi:a',
            title: 'A',
            team: 'team:orders',
            blocked_by: ['q:missing', 'dec:missing', 'q:pending'],
            depends_on: ['wi:missing', 'other/wi:missing'],
          },
        ],
      },
      { events: [] },
      context,
    );
    expect(gated.work[0]?.blockers).toEqual([
      { kind: 'question', id: 'q:pending', label: 'Pending?', state: 'open' },
    ]);
  });

  it('gives a milestone the latest promise among its items', () => {
    const both = standingOf(
      plan,
      {
        events: [
          at('2026-11-01', { kind: 'commitment', state: 'accepted', promised_for: '2027-04-01' }),
          at('2026-11-01', {
            subject: 'wi:lookup',
            kind: 'commitment',
            state: 'accepted',
            promised_for: '2027-03-15',
          }),
        ],
      },
      context,
    );
    expect(both.milestones[0]?.dates.promisedFor).toBe('2027-04-01');
    expect(both.milestones[0]?.rollup).toBe('accepted');
  });
});

describe('a milestone’s standing', () => {
  it('rolls up to declined when any item declined, and keeps its own commitment apart', () => {
    expect(milestone('ms:quote')?.rollup).toBe('declined');
    expect(milestone('ms:quote')?.commitment).toBeNull();
    expect(milestone('ms:quote')?.items).toEqual(['wi:quote', 'wi:lookup']);
  });

  it('is accepted only when it and all its items are', () => {
    expect(milestone('ms:revise')?.rollup).toBe('proposed');
    expect(milestone('ms:revise')?.commitment?.state).toBe('accepted');
    expect(milestone('ms:empty')?.rollup).toBeNull();
  });

  it('is blocked by a milestone it comes after that was declined, here or in another plan', () => {
    expect(milestone('ms:revise')?.blockers).toEqual([
      { kind: 'after', id: 'ms:quote', label: 'Ziklo can quote', state: 'declined' },
      {
        kind: 'after',
        id: 'care-financing/ms:status',
        label: 'care-financing/ms:status',
        state: 'declined',
      },
    ]);
  });

  it('needs its due date, takes the latest promise among its items, and hears from them', () => {
    expect(milestone('ms:quote')?.dates).toEqual({
      neededBy: '2027-02-28',
      promisedFor: '2027-03-01',
      gapDays: 1,
    });
    expect(milestone('ms:quote')?.lastHeard?.at).toBe('2026-11-04');
    expect(milestone('ms:revise')?.lastHeard?.at).toBe('2026-11-05');
  });
});

describe('rollUpCommitment', () => {
  it('declines over withdraws over the rest', () => {
    expect(rollUpCommitment('accepted', ['withdrawn', 'declined'])).toBe('declined');
    expect(rollUpCommitment(null, ['accepted', 'withdrawn'])).toBe('withdrawn');
  });

  it('accepts only when every commitment is accepted, an item without one included', () => {
    expect(rollUpCommitment(null, ['accepted', 'accepted'])).toBe('accepted');
    expect(rollUpCommitment('accepted', [])).toBe('accepted');
    expect(rollUpCommitment(null, ['accepted', null])).toBe('proposed');
    expect(rollUpCommitment('accepted', ['proposed'])).toBe('proposed');
    expect(rollUpCommitment(null, [null, null])).toBeNull();
    expect(rollUpCommitment(null, [])).toBeNull();
  });
});

describe('commitmentsOf', () => {
  it('gives each item its commitment and each milestone its roll-up', () => {
    expect(commitmentsOf(plan, { events })).toEqual({
      'wi:quote': 'accepted',
      'wi:lookup': 'declined',
      'wi:checkout': null,
      'wi:unknown-team': null,
      'ms:quote': 'declined',
      'ms:revise': 'proposed',
      'ms:empty': null,
    });
  });
});

describe('a team’s standing', () => {
  it('hears last from the newest event about any of its items', () => {
    expect(standing().teams).toEqual([
      {
        team: { id: 'team:ziklo', name: 'Ziklo', partner: true },
        items: ['wi:quote', 'wi:lookup'],
        lastHeard: { at: '2026-11-04', by: 'Louise', sourceKind: null, url: null },
      },
      {
        team: { id: 'team:orders', name: 'Orders', partner: false },
        items: ['wi:checkout'],
        lastHeard: {
          at: '2026-11-05',
          by: null,
          sourceKind: 'github',
          url: 'https://github.com/org/checkout/issues/41',
        },
      },
      {
        team: { id: 'team:elsewhere', name: 'team:elsewhere', partner: false },
        items: ['wi:unknown-team'],
        lastHeard: null,
      },
    ]);
  });
});

describe('lastHeardOf', () => {
  it('takes the one recorded later of two on the same day', () => {
    const heard = lastHeardOf([
      at('2026-11-04', { said_by: 'First' }),
      at('2026-11-04', { said_by: 'Second' }),
      at('2026-11-03', { said_by: 'Earlier' }),
    ]);
    expect(heard?.by).toBe('Second');
  });
});
