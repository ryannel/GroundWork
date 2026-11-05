import { beforeEach, describe, expect, it } from 'vitest';

import { careInput } from '@/../test/fixtures/plan-index';

import { byNewest, firstDate, firstOrder, milestoneVM, rolledUp } from './milestones';
import { partnerPageVM } from './partner-page';
import { type WorkspacePlanIndex, workspacePlanIndexOf } from './workspace-plan-index';

let index: WorkspacePlanIndex;

beforeEach(() => {
  index = workspacePlanIndexOf(careInput());
});

describe('partnerPageVM', () => {
  let page: ReturnType<typeof partnerPageVM>;
  beforeEach(() => {
    page = partnerPageVM(index, 'team:ziklo');
  });

  it('names the partner and who to talk to, and when we last heard', () => {
    expect(page?.team).toEqual({ id: 'team:ziklo', name: 'Ziklo', partner: true });
    expect(page?.contacts).toEqual([{ name: 'Louise A. Zieme', role: 'product' }]);
    expect(page?.lastHeard).toEqual({
      at: '2026-11-04',
      by: 'Louise A. Zieme',
      source: 'partner update',
      about: 'Provide the order-change quote',
      href: '/acme/plans/order-change/things/?id=wi-quote',
    });
  });

  it('lists its open milestones with what we need, what they promised and the gap, and its items', () => {
    expect(page?.milestones).toHaveLength(1);
    const [group] = page?.milestones ?? [];
    expect(group?.milestone).toEqual({
      key: 'order-change/ms:quote',
      id: 'ms:quote',
      scope: 'order-change',
      name: 'Ziklo can quote',
      href: '/acme/plans/order-change/things/?id=ms-quote',
      neededBy: '2027-02-28',
      promisedFor: '2027-03-01',
      gapDays: 1,
      gapText: '1 day after we need',
      commitment: 'proposed',
    });
    expect(group?.items.map((card) => card.key)).toEqual(['order-change/wi:quote']);
  });

  it('keeps the evidence with a link, and the whole history newest first', () => {
    expect(page?.evidence).toEqual([
      {
        at: '2026-10-20',
        source: 'meeting',
        url: 'https://notes.example/quote',
        note: null,
        by: 'Louise A. Zieme',
        about: 'Provide the order-change quote',
      },
    ]);
    expect(page?.history.map((e) => [e.at, e.what])).toEqual([
      ['2026-11-04', 'work in progress'],
      ['2026-10-20', 'commitment accepted'],
    ]);
  });

  it('is null for a team the workspace does not have', () => {
    expect(partnerPageVM(index, 'team:nobody')).toBeNull();
  });

  it('gives our own team its work too, soonest needed first and loose items last', () => {
    const ours = partnerPageVM(index, 'team:orders');
    expect(ours?.lastHeard?.source).toBe('not said');
    expect(ours?.milestones.map((g) => g.milestone?.key ?? null)).toEqual([
      'financing/ms:m1',
      'order-change/ms:quote',
      null,
    ]);
    expect(ours?.evidence.map((e) => e.url)).toEqual(['https://github.com/acme/finance/issues/12']);
  });
});

const at = (date: string, plan = 'p', subject = 's') => ({
  at: date,
  plan,
  subject,
  subjectLabel: '',
  href: '',
  what: '',
  by: null,
  source: '',
  url: null,
  note: null,
});

describe('milestone words', () => {
  it('rolls commitments up in words', () => {
    expect(rolledUp([])).toBeNull();
    expect(rolledUp([null])).toBeNull();
    expect(rolledUp(['accepted', 'accepted'])).toBe('accepted');
    expect(rolledUp(['accepted', null])).toBe('proposed');
    expect(rolledUp(['accepted', 'declined'])).toBe('declined');
    expect(rolledUp(['withdrawn', 'nonsense'])).toBe('withdrawn');
  });

  it('picks the first or last date, ignoring missing ones', () => {
    expect(firstDate([null, '2027-02-01', '2027-01-01'])).toBe('2027-01-01');
    expect(firstDate([null, '2027-02-01', '2027-01-01'], true)).toBe('2027-02-01');
    expect(firstDate([null])).toBeNull();
  });

  it('orders by the first comparison that tells two apart', () => {
    expect(firstOrder([0, -2, 5])).toBe(-2);
    expect(firstOrder([0, 0])).toBe(0);
    expect(byNewest(at('2027-01-02'), at('2027-01-01'))).toBeLessThan(0);
    expect(byNewest(at('2027-01-01', 'a'), at('2027-01-01', 'b'))).toBeLessThan(0);
    expect(byNewest(at('2027-01-01', 'a', 'y'), at('2027-01-01', 'a', 'x'))).toBeGreaterThan(0);
  });

  it('takes a milestone’s dates from its items when it has none of its own', () => {
    const items = [...index.work.values()].filter((w) => w.plan === 'order-change');
    const vm = milestoneVM(index, 'order-change', 'ms:none', items);
    expect(vm.name).toBe('ms:none');
    expect(vm.neededBy).toBe('2027-02-15');
    expect(vm.promisedFor).toBe('2027-03-01');
    expect(vm.gapDays).toBe(14);
    expect(vm.commitment).toBeNull();
  });
});
