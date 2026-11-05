import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { coverOf, statsOf, teamsWithWork } from '@/application/plan-story-cover';
import {
  approvedOn,
  asClause,
  askLines,
  gateTitle,
  gatesOf,
  heldUp,
  isApproved,
  planStage,
  possessive,
} from '@/application/plan-story-cover-standing';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const base = await loadFixture('mini.yaml');

type Over = Partial<typeof base>;
const withPlan = (over: Over) => derive({ ...base, ...over }, { today: '2026-10-17' });

const waiting = (decideBy?: string): Over => ({
  questions: [
    {
      id: 'q:price',
      question: 'Which price do we show?',
      decider: 'team:billing',
      status: 'open',
      blocks: ['wi:pause-endpoint'],
      ...(decideBy === undefined ? {} : { decide_by: decideBy }),
    },
  ],
});

describe('words', () => {
  it('makes a name possessive', () => {
    expect(possessive('Billing')).toBe('Billing’s');
    expect(possessive('Sales')).toBe('Sales’');
  });

  it('continues a title after a colon in lower case, keeping acronyms, with a full stop', () => {
    expect(asClause('Which price do we show')).toBe('which price do we show.');
    expect(asClause('VAT on the invoice?')).toBe('VAT on the invoice?');
  });
});

describe('stage', () => {
  it('reads the plan’s own status, with committed as approved', () => {
    expect(planStage(withPlan({}))).toBe('draft');
    expect(planStage(withPlan({ meta: { ...base.meta, status: 'committed' } }))).toBe('approved');
    expect(isApproved('approved')).toBe(true);
    expect(isApproved('review')).toBe(false);
  });

  it('puts the day of approval from the revisions', () => {
    expect(approvedOn(withPlan({}))).toBe('');
    const meta = {
      ...base.meta,
      revisions: [
        {
          version: '1.0',
          status: 'approved' as const,
          date: '2026-09-20',
          approved_on: '2026-09-25',
        },
      ],
    };
    expect(approvedOn(withPlan({ meta }))).toBe('25 Sep');
  });
});

const TODAY = '2026-10-17';

describe('the ask', () => {
  it('names what is left to settle, soonest first', () => {
    const model = withPlan(waiting('2999-01-05'));
    const [gate] = gatesOf(model);
    expect(gate).toBeDefined();
    if (gate === undefined) return;
    expect(gateTitle(gate)).toContain('price');
    expect(heldUp(model, 'q:price')).toContain('wi:pause-endpoint');
    const [line] = askLines(model, TODAY);
    expect(line?.tone).toBe('note');
    expect(line?.text).toContain('Billing decides first, by 5 Jan');
    expect(line?.link?.screen).toBe('ask');
  });

  it('warns when the answer is already late and counts the rest', () => {
    const questions = [
      ...(waiting('2001-01-05').questions ?? []),
      {
        id: 'q:vat',
        question: 'Is VAT shown?',
        decider: 'team:web',
        status: 'open' as const,
        decide_by: '2001-02-01',
        blocks: ['wi:pause-endpoint'],
      },
      {
        id: 'q:tax',
        question: 'Which tax code?',
        status: 'open' as const,
        blocks: ['wi:pause-endpoint'],
      },
    ];
    const [line] = askLines(withPlan({ questions }), TODAY);
    expect(line?.tone).toBe('warn');
    expect(line?.text).toContain('answer was due 5 Jan 2001');
    expect(line?.text).toContain('more have to be settled before approval');
  });

  it('says the owner can approve once nothing is left to decide', () => {
    const lines = askLines(withPlan({ questions: [], decisions: [] }), TODAY);
    expect(lines).toEqual([
      {
        tone: 'note',
        text: 'Nothing is left to decide: the owner can approve it by merging.',
        link: { chapter: 'commit', screen: 'ask', label: 'Still to settle →' },
      },
    ]);
  });

  it('says how an approved plan is being built', () => {
    const meta = {
      ...base.meta,
      status: 'committed' as const,
      version: '1.2',
      revisions: [
        {
          version: '1.2',
          status: 'approved' as const,
          date: '2026-09-20',
          approved_on: '2026-09-25',
        },
      ],
    };
    expect(askLines(withPlan({ meta }), TODAY)[0]?.text).toBe(
      'Teams build from 1.2, approved 25 Sep.',
    );
  });

  it('says where an approved plan stands once work has begun, and when it is done', () => {
    const meta = { ...base.meta, status: 'committed' as const };
    const issues = (base.work_items ?? []).map((w, i) => ({ ...w, github_issue: i + 1 }));
    const started = askLines(withPlan({ meta, work_items: issues }), TODAY);
    expect(started.length).toBeLessThanOrEqual(1);
    const model = withPlan({ meta, work_items: issues });
    expect(planStage(model)).toBe('in-delivery');
  });
});

describe('the cover', () => {
  it('lists up to four measures, leaving out a "today" that says nothing', () => {
    const metrics = ['a', 'b', 'c', 'd', 'e'].map((m) => ({
      name: m,
      today: 'today 4',
      target: '1',
    }));
    const model = withPlan({ problem: { ...base.problem, metrics } });
    expect(statsOf(model)).toHaveLength(4);
    expect(statsOf(model)[0]?.today).toBeNull();
    expect(
      statsOf(
        withPlan({
          problem: { ...base.problem, metrics: [{ name: 'x', today: '3 days', target: '1' }] },
        }),
      )[0]?.today,
    ).toBe('3 days');
    expect(statsOf(withPlan({ problem: { summary: base.problem.summary } }))).toEqual([]);
  });

  it('opens a door to each team with something to do', () => {
    const model = withPlan({});
    const cover = coverOf(model, TODAY);
    expect(cover.title).toBe(base.meta.title);
    expect(cover.teams).toEqual(teamsWithWork(model));
    expect(cover.teams).toContain('team:subs');
  });
});
