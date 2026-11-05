import { describe, expect, it } from 'vitest';

import type { WorkStanding } from '@/application/plan/work-standing';

import { blockerHref, gapText, ownershipOf, sourceWord, stateWord, workCardVM } from './work-card';

const ZIKLO = { id: 'team:ziklo', name: 'Ziklo', partner: true };
const ORDERS = { id: 'team:orders', name: 'Orders', partner: false };

const standing = (patch: Partial<WorkStanding> = {}): WorkStanding => ({
  item: { id: 'wi:quote', title: 'Provide the quote', milestone: 'ms:m3', issue: 41 },
  team: ZIKLO,
  commitment: {
    state: 'accepted',
    promisedFor: '2027-03-01',
    confidence: 'medium',
    saidBy: 'Louise A. Zieme',
    at: '2026-10-20',
    source: null,
  },
  progress: { state: 'in_progress', at: '2027-01-12', source: null },
  lastHeard: { at: '2026-11-04', by: 'Louise A. Zieme', sourceKind: 'meeting', url: null },
  dates: { neededBy: '2027-02-15', promisedFor: '2027-03-01', gapDays: 14 },
  blockers: [],
  ...patch,
});

const CONTEXT = {
  workspace: 'acme',
  plan: 'order-change',
  programmes: ['care'],
  milestoneLabel: 'M3 · Ziklo can quote',
  issue: { url: 'https://github.com/acme/orders/issues/41', state: 'open' as const },
};

describe('workCardVM', () => {
  it('words a partner’s item: we depend on it, it has no issue, and its promise is later than we need', () => {
    const card = workCardVM(standing(), CONTEXT);
    expect(card).toEqual({
      id: 'wi:quote',
      key: 'order-change/wi:quote',
      plan: 'order-change',
      href: '/acme/plans/order-change/things/?id=wi-quote',
      title: 'Provide the quote',
      team: ZIKLO,
      ownership: 'we depend on this',
      milestone: { id: 'ms:m3', label: 'M3 · Ziklo can quote' },
      issue: null,
      commitment: {
        state: 'accepted',
        promisedFor: '2027-03-01',
        confidence: 'medium',
        saidBy: 'Louise A. Zieme',
      },
      progress: { state: 'in progress', at: '2027-01-12' },
      dates: {
        neededBy: '2027-02-15',
        promisedFor: '2027-03-01',
        gapDays: 14,
        gapText: '14 days after we need',
      },
      lastHeard: { at: '2026-11-04', by: 'Louise A. Zieme', source: 'meeting' },
      blockers: [],
      done: false,
    });
  });

  it('gives our item its GitHub issue and says the team owns it', () => {
    const card = workCardVM(standing({ team: ORDERS }), CONTEXT);
    expect(card.ownership).toBe('Orders owns');
    expect(card.issue).toEqual({
      number: 41,
      url: 'https://github.com/acme/orders/issues/41',
      state: 'open',
    });
  });

  it('has no issue for our item that was never filed, and no url or state when none is known', () => {
    const unfiled = standing({
      team: ORDERS,
      item: { id: 'wi:x', title: 'X', milestone: null, issue: null },
    });
    expect(workCardVM(unfiled, CONTEXT).issue).toBeNull();
    expect(workCardVM(unfiled, CONTEXT).milestone).toBeNull();
    const bare = workCardVM(standing({ team: ORDERS }), { workspace: 'acme', plan: 'p' });
    expect(bare.issue).toEqual({ number: 41, url: null, state: null });
    expect(bare.milestone).toEqual({ id: 'ms:m3', label: 'ms:m3' });
  });

  it('says nothing promised, heard or done when nothing was recorded', () => {
    const card = workCardVM(
      standing({ commitment: null, progress: null, lastHeard: null }),
      CONTEXT,
    );
    expect(card.commitment).toBeNull();
    expect(card.progress).toBeNull();
    expect(card.lastHeard).toBeNull();
    expect(card.done).toBe(false);
  });

  it('is done when its latest work event says so', () => {
    const done = standing({ progress: { state: 'done', at: '2027-02-01', source: null } });
    expect(workCardVM(done, CONTEXT).done).toBe(true);
    expect(workCardVM(done, CONTEXT).progress?.state).toBe('done');
  });

  it('words each blocker and links it where it is read', () => {
    const card = workCardVM(
      standing({
        blockers: [
          { kind: 'question', id: 'q:shape', label: 'What shape?', state: 'open' },
          { kind: 'decision', id: 'care/dec:replaces', label: 'Replace it', state: 'proposed' },
          { kind: 'depends-on', id: 'financing/wi:status', label: 'Status API', state: 'declined' },
          { kind: 'after', id: 'ms:m1', label: 'M1', state: null },
        ],
      }),
      CONTEXT,
    );
    expect(card.blockers).toEqual([
      {
        id: 'q:shape',
        label: 'Open question: What shape?',
        href: '/acme/plans/order-change/things/?id=q-shape',
      },
      {
        id: 'care/dec:replaces',
        label: 'Decision not made: Replace it',
        href: '/acme/programmes/care/',
      },
      {
        id: 'financing/wi:status',
        label: 'Status API (declined)',
        href: '/acme/plans/financing/things/?id=wi-status',
      },
      { id: 'ms:m1', label: 'M1 (stopped)', href: '/acme/plans/order-change/things/?id=ms-m1' },
    ]);
  });
});

describe('words', () => {
  it('says how late a promise is only when it is later than we need', () => {
    expect(gapText(null)).toBeNull();
    expect(gapText(0)).toBeNull();
    expect(gapText(-3)).toBeNull();
    expect(gapText(1)).toBe('1 day after we need');
    expect(gapText(2)).toBe('2 days after we need');
  });

  it('words states, sources and owners', () => {
    expect(stateWord('not_started')).toBe('not started');
    expect(sourceWord('partner-update')).toBe('partner update');
    expect(sourceWord('github')).toBe('GitHub');
    expect(sourceWord(null)).toBe('not said');
    expect(ownershipOf(ZIKLO)).toBe('we depend on this');
    expect(ownershipOf(ORDERS)).toBe('Orders owns');
  });

  it('links a qualified id to its plan unless it names a programme', () => {
    expect(blockerHref('other/q:x', { workspace: 'acme', plan: 'p' })).toBe(
      '/acme/plans/other/things/?id=q-x',
    );
    expect(blockerHref('care/q:x', { workspace: 'acme', plan: 'p', programmes: ['care'] })).toBe(
      '/acme/programmes/care/',
    );
  });
});
