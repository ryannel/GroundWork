import { describe, expect, it, vi } from 'vitest';

import { briefsOf, planBriefOf } from './workspace-library-plans';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');
const draft = { slug: 'draft', plan, status: {} };
const inReview = {
  slug: 'review',
  plan: { ...plan, meta: { ...plan.meta, status: 'review' as const } },
  status: {},
};
const moving = {
  slug: 'moving',
  plan: {
    ...plan,
    work_items: (plan.work_items ?? []).map((item, index) => ({
      ...item,
      github_issue: index + 1,
    })),
  },
  status: { 'wi:pause-endpoint': { state: 'closed' as const } },
};
const before = new Date('2026-10-01T12:00:00Z');
const after = new Date('2026-10-20T12:00:00Z');

describe('planBriefOf', () => {
  it('says who decides next and by when for a plan in review', () => {
    const brief = planBriefOf('shop', inReview, before);
    expect(brief.group).toBe('decide');
    expect(brief.note).toBe('Subscriptions decides first, by 10 Oct');
    expect(brief.late).toBe(false);
  });

  it('flags a decision whose day has gone', () => {
    const brief = planBriefOf('shop', inReview, after);
    expect(brief.note).toBe('Subscriptions’ answer was due 10 Oct');
    expect(brief.late).toBe(true);
  });

  it('counts the work done on a plan in delivery', () => {
    const brief = planBriefOf('shop', moving, before);
    expect(brief.group).toBe('delivery');
    expect(brief.done).toBe(1);
    expect(brief.note).toMatch(/^1 of \d+ work items done/u);
  });

  it('calls a plan nobody has proposed a draft', () => {
    expect(planBriefOf('shop', draft, before)).toMatchObject({
      group: 'draft',
      note: 'Being written',
    });
  });
});

describe('briefsOf', () => {
  it('puts what needs a decision first, then what is moving, then drafts', () => {
    const briefs = briefsOf('shop', [draft, moving, inReview], before);
    expect(briefs.map((brief) => brief.id)).toEqual(['review', 'moving', 'draft']);
  });
});
