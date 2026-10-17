import { describe, expect, it, vi } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { acme } from '@/../test/workspace-kit';
import { weekdayProblems } from '@/application/plan/check-text';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

describe('weekdayProblems', () => {
  it('knows 9 Oct 2026 is a Friday and 4 Oct 2026 a Sunday', () => {
    expect(weekdayProblems('Get it by Thu 9 Oct', '2026').map((p) => p.actual)).toEqual(['Friday']);
    expect(weekdayProblems('Get it by Fri 9 Oct', '2026')).toEqual([]);
    expect(weekdayProblems('Sunday 4 October', '2026')).toEqual([]);
    expect(weekdayProblems('Friday 10 October', '2026').map((p) => p.date)).toEqual(['2026-10-10']);
  });
  it('reads every written form: ordinals, "of", month first, ISO, an explicit year', () => {
    expect(weekdayProblems('Mon, 13th of Oct', '2026')).toHaveLength(1);
    expect(weekdayProblems('Thu Oct 9', '2026')).toHaveLength(1);
    expect(weekdayProblems('Thu 2026-10-09')).toHaveLength(1);
    expect(weekdayProblems('Thu 9 Oct 2025', '2026')).toHaveLength(0);
    expect(weekdayProblems('Thu 9 Oct 2026', '2025')).toHaveLength(1);
  });
  it('leaves a weekday without a date, or a date without a weekday, alone', () => {
    expect(weekdayProblems('order by 14:00 Mon; ships on 9 Oct', '2026')).toEqual([]);
    expect(weekdayProblems('Sunday evening, Thursday on the page', '2026')).toEqual([]);
    expect(weekdayProblems('Mon 31 Feb', '2026')).toEqual([]);
    expect(weekdayProblems('Thu 9 Oct')).toEqual([]);
  });
});

const withProse = async (text: string): Promise<Plan> => {
  const p = await loadFixture('mini.yaml');
  p.problem.summary = text;
  return p;
};
const atSummary = (p: Plan) => validatePlan(p).errors.filter((e) => e.path === 'problem.summary');

describe('validate: weekdays', () => {
  it('reports a wrong weekday at the prose that says it', async () => {
    const hit = atSummary(await withProse('Anna sees *Get it by Thu 9 Oct* on the page.'))[0];
    expect(hit?.message).toMatch(/says Thu, but 2026-10-09 is a Friday/u);
  });
  it('takes the year of meta.date for dates without one', async () => {
    const p = await withProse('Thu 9 Oct');
    p.meta.date = '2025-10-01';
    expect(atSummary(p)).toEqual([]);
  });
  it('passes a right weekday', async () => {
    expect(atSummary(await withProse('Fri 9 Oct and Sunday 4 October'))).toEqual([]);
  });
});

describe('team colours', () => {
  it('takes a palette slot from 1 to 13', async () => {
    const ok = await loadFixture('mini.yaml');
    const first = ok.teams[0];
    if (first) first.colour = 13;
    expect(validatePlan(ok).errors).toEqual([]);
  });
  it('warns when two teams share a slot while the palette has a free one', async () => {
    const p = await loadFixture('mini.yaml');
    for (const t of p.teams.slice(0, 2)) t.colour = 3;
    const { warnings } = validatePlan(p);
    expect(
      warnings.some(
        (w) => w.path === 'teams[1].colour' && w.message.includes('same colour (3) as team:web'),
      ),
    ).toBe(true);
  });
  it('stays quiet once there are more teams than slots', async () => {
    const p = await loadFixture('mini.yaml');
    p.teams = Array.from({ length: 14 }, (_, i) => ({
      id: `team:t${String(i)}`,
      name: `T${String(i)}`,
      colour: (i % 13) + 1,
    }));
    p.services = p.services.map((s) => ({ ...s, team: 'team:t0' }));
    expect(validatePlan(p).warnings.filter((w) => w.path.includes('colour'))).toEqual([]);
  });
});

const PLANS: Readonly<Record<string, () => Plan>> = {
  'gift-wrap': giftWrap,
  'pause-orders': pauseOrders,
  'order-event-v2': orderEventV2,
  shop: shopGraph,
};

describe('the fixture plans', () => {
  it.each(Object.keys(PLANS))('%s: no weekday disagrees with its date', (slug) => {
    const plan = PLANS[slug]?.();
    expect(plan).toBeDefined();
    const errors = plan === undefined ? [] : validatePlan(plan).errors;
    expect(errors.filter((e) => /says \w+, but/u.test(e.message))).toEqual([]);
  });

  it('gives every team the slot the workspace gives it, the same across plans', () => {
    const slots = new Map(acme().workspace.teams.map((t) => [t.id, t.colour ?? undefined]));
    const onAcme = [giftWrap(), pauseOrders(), orderEventV2()];
    const seen = new Map<string, number | null | undefined>();
    for (const plan of onAcme) {
      for (const t of plan.teams) {
        expect(t.colour ?? undefined, `${plan.meta.id}: ${t.id}`).toBe(slots.get(t.id));
        expect(t.colour, `${t.id} changes colour`).toBe(seen.has(t.id) ? seen.get(t.id) : t.colour);
        seen.set(t.id, t.colour);
      }
    }
    expect([...seen.keys()].toSorted((a, b) => a.localeCompare(b))).toEqual(
      [...slots.keys()].toSorted((a, b) => a.localeCompare(b)),
    );
  });
});
