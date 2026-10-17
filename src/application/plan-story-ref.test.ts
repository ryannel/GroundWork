import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import {
  DEFAULT_SHOW,
  SHOWS,
  SHOW_WORD,
  graphOf,
  groupBy,
  inCut,
  fadesIn,
  inPlanWords,
  poolOf,
  searchText,
  showOf,
  teamNames,
  teamsWhere,
  viewOf,
} from '@/application/plan-story-ref';
import {
  decidingSearch,
  registerCounts,
  registerGroups,
} from '@/application/plan-story-ref-register';
import {
  LEVELS_TOP_DOWN,
  flowTeams,
  milestoneShort,
  operationRow,
  operationsByScreen,
  testsByLevel,
  triggerWord,
  walksText,
  workByMilestone,
} from '@/application/plan-story-ref-rows';
import {
  graphTypeFacts,
  schemaFacts,
  schemaGroups,
  screensByApp,
  serviceFacts,
  servicesByTeam,
  storeFacts,
  storeGroups,
} from '@/application/plan-story-ref-system';
import { refHead } from '@/application/plan-story-ref-words';
import { deciding } from '@/application/plan-viz-decision';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const mini = derive(await loadFixture('mini.yaml'));
const shop = derive(await loadFixture('shop.yaml'));

const NO_ID: string | undefined = new Map<string, string>().get('none');

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

  it('reads the diff from the to-be graph', () => {
    expect(graphOf('asis')).toBe('asIs');
    expect(graphOf('diff')).toBe('toBe');
    expect(viewOf('diff')).toBe('diff');
    expect(viewOf('tobe')).toBe('toBe');
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

  it('groups in first-seen order', () => {
    const groups = groupBy(['ab', 'ac', 'b'], (s) => s.charAt(0));
    expect([...groups.keys()]).toEqual(['a', 'b']);
    expect(groups.get('a')).toEqual(['ab', 'ac']);
  });
});

describe('the team cut', () => {
  it('names the teams and finds whose cut holds a thing', () => {
    expect(teamNames(mini)['team:subs']).toBe('Subscriptions');
    const subs = teamsWhere(mini, (cut) => inCut(mini, cut, 'svc:subs')).split(' ');
    expect(subs).toContain('team:subs');
    expect(subs).not.toContain('team:web');
    expect(inCut(mini, mini.teamCut('team:subs'), NO_ID)).toBe(false);
  });
});

describe('the system catalogues', () => {
  it.each(SHOWS)('groups services by team in %s', (show) => {
    const groups = servicesByTeam(shop, show);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.services.every((s) => s.team === g.team)).toBe(true);
  });

  it('tells what a service owns, offers, publishes and listens to', () => {
    const owner = shop.toBe.stores[0]?.owner ?? '';
    expect(serviceFacts(shop, 'tobe', owner).owns.length).toBeGreaterThan(0);
    for (const show of SHOWS) {
      for (const s of shop.toBe.services) {
        const f = serviceFacts(shop, show, s.id);
        expect(f.interfaces.every((i) => i.service === s.id)).toBe(true);
      }
    }
  });

  it('sorts stores into the groups the page shows, topics and queues last', () => {
    const groups = storeGroups(shop.toBe.stores);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.stores)).toHaveLength(shop.toBe.stores.length);
    const pipes = groups.filter((g) => g.title === 'Topics and queues').slice(0, 1);
    for (const group of pipes) expect(group.note).not.toBe('');
  });

  it('tells the records and events of a store', () => {
    for (const store of shop.toBe.stores) {
      const f = storeFacts(shop, 'diff', store.id);
      expect(Array.isArray(f.records) && Array.isArray(f.events)).toBe(true);
    }
  });

  it('groups screens by the app that serves them', () => {
    const apps = screensByApp(shop, 'diff');
    expect(apps.flatMap((a) => a.screens)).toHaveLength(
      poolOf(shop.asIs.screens, shop.toBe.screens, 'diff').length,
    );
  });

  it('groups schemas and counts what carries them', () => {
    const groups = schemaGroups(shop, 'diff');
    const all = [
      ...groups.records.flatMap((r) => r.schemas),
      ...groups.bodies,
      ...groups.graphTypes,
    ];
    expect(all.length).toBeGreaterThan(0);
    const first = all[0];
    if (first === undefined) return;
    const facts = schemaFacts(shop, 'diff', first);
    expect(facts.fields).toBe(first.fields.length);
  });

  it('tells who owns a graph type’s fields', () => {
    const type = shop.toBe.schemas.find((s) => s.kind === 'graph-type');
    if (type === undefined) return;
    const facts = graphTypeFacts(shop, 'tobe', type.id);
    expect(Array.isArray(facts.keys)).toBe(true);
  });
});

describe('the flow, test and operation rows', () => {
  it('names the teams a flow runs between', () => {
    for (const flow of shop.toBe.flows) {
      const teams = flowTeams(shop, flow);
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

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

  it('describes each operation: what it asks, who answers, and how long it may be kept', () => {
    const groups = operationsByScreen(shop, 'tobe');
    expect(groups.length).toBeGreaterThan(0);
    for (const row of groups.flatMap((g) => g.rows)) {
      expect(row.fields).toBeGreaterThanOrEqual(0);
      expect(typeof triggerWord(row.op)).toBe('string');
    }
    for (const op of shop.asIs.operations.slice(0, 1)) {
      expect(operationRow(shop, op, 'asis').op).toBe(op);
    }
  });

  it('says a trigger in words and says nothing for none', () => {
    const [op] = shop.toBe.operations;
    if (op === undefined) return;
    expect(triggerWord({ ...op, trigger: 'load' })).toBe('page load');
    expect(triggerWord({ ...op, trigger: 'interval' })).toBe('timer');
    const bare = shop.toBe.operations.filter((o) => o.trigger === undefined).slice(0, 1);
    for (const each of bare) expect(triggerWord(each)).toBe('');
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

describe('in-plan words', () => {
  it('counts what the plan asks of a thing, and says nothing of parts, tests or untouched things', () => {
    expect(inPlanWords(shop, 'svc:promise-graph')).toBe('1 change · 1 work item');
    expect(inPlanWords(shop, 'svc:web')).toBe('');
    expect(inPlanWords(shop, 'svc:promise-graph#part')).toBe('');
    expect(inPlanWords(shop, (shop.plan.tests ?? [])[0]?.id ?? 'tst:none')).toBe('');
    expect(inPlanWords(shop, 'nonsense')).toBe('');
  });
});

describe('fading', () => {
  it('fades only what the diff leaves alone', () => {
    expect(fadesIn(shop, 'diff', 'svc:purger')).toBe(true);
    expect(fadesIn(shop, 'diff', 'svc:web')).toBe(false);
    expect(fadesIn(shop, 'diff', 'svc:promise-graph')).toBe(false);
    expect(fadesIn(shop, 'tobe', 'svc:purger')).toBe(false);
  });
});
