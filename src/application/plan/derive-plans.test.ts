import { describe, expect, it, vi } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import {
  giftWrapVersioned,
  orderEventVersioned,
} from '@/../test/fixtures/acme/plans/versions-gift-wrap';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { modelOf } from '@/../test/plan-kit';
import { derive, type Model } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const PLANS: Readonly<Record<string, () => Plan>> = {
  'gift-wrap': giftWrap,
  'pause-orders': pauseOrders,
  'order-event-v2': orderEventV2,
  shop: shopGraph,
  'gift-wrap 1.2': () => giftWrapVersioned().plan,
  'order-event-v2 1.1': () => orderEventVersioned().plan,
};

/** Ask the model everything it can be asked about every thing in the plan; none of it may throw. */
function askAll(m: Model): void {
  for (const mode of ['asIs', 'toBe'] as const) {
    const g = m.graphOf(mode);
    for (const id of g.byId.keys()) {
      m.label(id);
      m.rollup(id);
      m.ownerService(id);
      m.ownerTeam(id);
      m.storyRefs(id);
      m.inverse(id);
      m.diff(id);
      m.versions(id);
      m.ladder(id);
    }
    for (const kind of ['api', 'msg', 'data'] as const) m.edges(mode, kind);
    m.domainLinks(mode);
    m.storeGrid(mode);
    for (const f of g.flows) m.spans(f.id, mode);
    for (const s of g.screens) m.look(s.id, mode);
  }
  for (const c of m.plan.changes ?? []) {
    m.touchedBy(c.id);
    m.teamsOf(c.id);
    m.blockersOf(c.id);
    m.statusOf(c.id);
  }
  for (const t of m.plan.teams) m.teamCut(t.id);
  for (const s of m.plan.screens ?? []) {
    m.screenDiff(s.id);
    m.flowsOnScreen(s.id, 'toBe');
  }
  m.coverage();
  m.health();
  m.orphans();
  m.criticalPath();
  m.topoOrder();
  m.waves();
  m.milestoneViolations();
  m.glossaryTerms();
  m.domain();
  m.decisionRegister();
  m.touchedAsIs();
}

describe('the fixture plans', () => {
  it.each(Object.keys(PLANS))('%s: derives and answers every question', (slug) => {
    const plan = PLANS[slug]?.();
    if (plan === undefined) throw new Error(`no ${slug}`);
    const m = modelOf(plan, {
      status: { 'wi:wrap-sheet': { state: 'closed', closed_at: '2026-05-30' } },
    });
    askAll(m);
    expect(m.validation().errors).toEqual([]);
  });

  it.each([
    ['gift-wrap', giftWrapVersioned],
    ['order-event-v2', orderEventVersioned],
  ])('%s: derives from every revision', (_, versioned) => {
    const { plan, versions, snapshots } = versioned();
    const earlier = Object.values(snapshots);
    expect(earlier.length).toBeGreaterThan(0);
    expect(versions.revision.steps).toHaveLength(plan.meta.revisions?.length ?? -1);
    for (const snapshot of earlier) askAll(derive(snapshot));
  });
});

describe('a plan with only the required sections', () => {
  it('validates, derives and answers every question', async () => {
    const full = await loadFixture('mini.yaml');
    const bare: Plan = {
      meta: full.meta,
      problem: { summary: 'Plain words.', glossary: full.problem.glossary ?? [] },
      teams: full.teams,
      services: full.services,
    };
    delete bare.meta.revisions;
    const m = derive(bare);
    askAll(m);
    expect(m.validation().errors).toEqual([]);
    expect(m.decisionRegister().every((g) => g.items.length === 0)).toBe(true);
    expect(m.glossaryTerms().terms.length).toBeGreaterThan(0);
  });
});
