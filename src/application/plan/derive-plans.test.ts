import { describe, expect, it, vi } from 'vitest';

import { derive, type Model } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const { listPlans, listRevisions, readPlan, readRevision, readStatus } =
  await import('@/infrastructure/plan-store');

const WORKSPACE = 'alder-finch';

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

async function planOf(slug: string, version?: string): Promise<Plan> {
  const { plan, errors } =
    version === undefined
      ? await readPlan(WORKSPACE, slug)
      : await readRevision({ workspace: WORKSPACE, slug, version });
  if (plan === null) throw new Error(`${slug}: ${JSON.stringify(errors)}`);
  return plan;
}

describe('the alder-finch plans', () => {
  it('lists the plans of the workspace', async () => {
    expect(await listPlans(WORKSPACE)).toEqual([
      'delivery-promise',
      'invoice-vat-number',
      'stock-reservation',
      'storefront-graph',
    ]);
  });

  it.each(['delivery-promise', 'invoice-vat-number', 'stock-reservation', 'storefront-graph'])(
    '%s: derives and answers every question',
    async (slug) => {
      const status = await readStatus(WORKSPACE, slug);
      const plan = await planOf(slug);
      const m = derive(plan, { status });
      askAll(m);
      expect(m.validation().errors).toEqual([]);
    },
  );

  it.each(['invoice-vat-number', 'stock-reservation'])(
    '%s: derives from every revision',
    async (slug) => {
      const versions = await listRevisions(WORKSPACE, slug);
      expect(versions.length).toBeGreaterThan(0);
      for (const v of versions) askAll(derive(await planOf(slug, v)));
    },
  );
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
