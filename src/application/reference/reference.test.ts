import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { deciding } from '@/application/plan-viz-decision';
import { refHead } from '@/application/reference/headings';
import {
  DEFAULT_SHOW,
  SHOWS,
  SHOW_WORD,
  poolOf,
  searchText,
  showOf,
  teamNames,
  teamsWhere,
} from '@/application/reference/model';
import {
  decidingSearch,
  registerCounts,
  registerGroups,
  LEVELS_TOP_DOWN,
  milestoneShort,
  testsByLevel,
  walksText,
  workByMilestone,
} from '@/application/reference/register';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const mini = derive(await loadFixture('mini.yaml'));
const shop = derive(await loadFixture('shop.yaml'));

describe('modes', () => {
  it('knows the three modes, with today first and the diff as the default', () => {
    expect(SHOWS).toEqual(['asis', 'tobe', 'diff']);
    expect(DEFAULT_SHOW).toBe('diff');
    expect(SHOWS.map((s) => SHOW_WORD[s])).toEqual(['Today', 'With this plan', 'What changes']);
  });

  it('reads a mode from the address, and falls back to the default', () => {
    expect(showOf('asis')).toBe('asis');
    expect(showOf('nonsense')).toBe('diff');
    expect(showOf(null)).toBe('diff');
  });

  it('pools today’s, the plan’s, or both with what is removed', () => {
    const asIs = [{ id: 'a' }, { id: 'b' }];
    const toBe = [{ id: 'b' }, { id: 'c' }];
    expect(poolOf(asIs, toBe, 'asis')).toBe(asIs);
    expect(poolOf(asIs, toBe, 'tobe')).toBe(toBe);
    expect(poolOf(asIs, toBe, 'diff').map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('words for the filter', () => {
  it('lower-cases text and numbers and drops the rest', () => {
    expect(searchText('Pause', ['A B', 3], undefined, '', null)).toBe('pause a b 3');
  });
});

describe('the team cut', () => {
  it('names the teams and finds whose cut holds a thing', () => {
    expect(teamNames(mini)['team:subs']).toBe('Subscriptions');
    const subs = teamsWhere(mini, (cut) => cut.has('svc:subs')).split(' ');
    expect(subs).toContain('team:subs');
    expect(subs).not.toContain('team:web');
  });
});

describe('test and work rows', () => {
  it('counts what a test walks, in words', () => {
    expect(walksText({})).toBe('');
    expect(walksText({ walks: ['flow:a'] })).toBe('1 whole flow');
    expect(walksText({ walks: ['flow:a#1', 'flow:a#2', 'flow:b'] })).toBe('2 steps · 1 whole flow');
  });

  it('puts tests under their level, widest first, leaving out an empty level', () => {
    const unit = shop.plan.tests?.find((t) => t.level === 'unit');
    const e2e = shop.plan.tests?.find((t) => t.level === 'e2e');
    if (unit === undefined || e2e === undefined) return;
    const tests = [unit, e2e, unit];
    const levels = testsByLevel(tests);
    expect(levels.map((l) => l.level)).toEqual(['e2e', 'unit']);
    expect(levels[1]?.tests).toHaveLength(2);
    expect(LEVELS_TOP_DOWN[0]).toBe('e2e');
  });

  it('puts work under its milestones, and the unplaced last', () => {
    const groups = workByMilestone(mini);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.items)).toHaveLength((mini.plan.work_items ?? []).length);
    expect(milestoneShort({ id: 'ms:a', name: 'M1 · Skeleton' })).toBe('M1');
    expect(milestoneShort({ id: 'ms:a', name: 'Skeleton' })).toBe('Skeleton');
    const loose = derive({
      ...mini.plan,
      work_items: (mini.plan.work_items ?? []).map((w) => ({ ...w, milestone: 'ms:gone' })),
    });
    expect(workByMilestone(loose).at(-1)?.milestone).toBeNull();
  });
});

describe('the register and the heads', () => {
  it('lists the non-empty groups of the register with the totals', () => {
    const groups = registerGroups(mini);
    const { total, counts } = registerCounts(mini);
    expect(total).toBe(groups.reduce((n, g) => n + g.ids.length, 0));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('gives each decision or question the words it is found by', () => {
    for (const group of mini.decisionRegister()) {
      for (const item of group.items) {
        const found = [deciding(mini, item.id)].filter((each) => each !== undefined);
        for (const each of found) {
          expect(decidingSearch(mini, each)).toContain(item.id.toLowerCase());
        }
      }
    }
  });

  it.each([
    'services',
    'stores',
    'apis',
    'schemas',
    'events',
    'flows',
    'screens',
    'operations',
    'ledger',
    'tests',
    'teams',
    'decisions',
    'work',
    'milestones',
    'risks',
  ])('heads the %s catalogue with a headline', (key) => {
    expect(refHead(shop, key).headline).not.toBe('');
    expect(refHead(mini, key).headline).not.toBe('');
  });

  it('heads an unknown catalogue with a plain word', () => {
    expect(refHead(mini, 'nope')).toEqual({ headline: 'Reference', lede: '' });
  });
});
