// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive, type Model } from '@/application/plan/derive';
import type { GraphDiff, OperationChange } from '@/application/plan/federation-diff';
import type { PlanSummary } from '@/application/plan/federation-model';
import { graphChange } from '@/application/plan-story-changes-graph';
import { graphClaim, opImpact } from '@/application/plan-story-changes-graph-ops';

vi.mock('server-only', () => ({}));

async function load(plan: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', plan);
  if (loaded.plan === null) throw new Error(`no plan ${plan}`);
  return derive(loaded.plan);
}

const real = await load('storefront-graph');
const graphId = 'graph:storefront';
const base = real.graphDiff(graphId);
const ids = base.operations.map((o) => o.id);

const summary = (over: Partial<PlanSummary> = {}): PlanSummary => ({
  fetches: 1,
  roundTrips: 1,
  subgraphs: ['sg:a'],
  maxAge: 0,
  scope: 'public',
  cacheable: false,
  ...over,
});

const change = (
  n: number,
  before: PlanSummary | null,
  after: PlanSummary | null,
): OperationChange => ({
  id: ids[n] ?? '',
  status: before === null ? 'added' : 'modified',
  before,
  after,
  changed: [],
});

const diffOf = (operations: OperationChange[], over: Partial<GraphDiff> = {}): GraphDiff => ({
  ...base,
  fields: [],
  caches: [],
  subgraphs: [],
  ...over,
  operations,
});

const modelWith = (diff: GraphDiff): Model => ({ ...real, graphDiff: () => diff });

describe('graph claim', () => {
  it('has operations to work with', () => {
    expect(ids.length).toBeGreaterThan(3);
  });

  it('names what stops being cached at the edge', () => {
    const one = diffOf([change(0, summary({ cacheable: true }), summary())]);
    expect(graphClaim(real, one)).toContain('is no longer cached');
    const two = diffOf([
      change(0, summary({ cacheable: true }), summary()),
      change(1, summary({ cacheable: true }), summary()),
    ]);
    expect(graphClaim(real, two)).toContain('are no longer cached');
  });

  it('pairs operations that add the same trips, and spells out the ones that differ', () => {
    const same = diffOf([
      change(0, summary(), summary({ roundTrips: 3 })),
      change(1, summary(), summary({ roundTrips: 3 })),
      change(2, summary(), summary({ roundTrips: 3 })),
    ]);
    expect(graphClaim(real, same)).toMatch(/go from 1 to 3 round trips.*one more/u);
    const apart = diffOf([
      change(0, summary(), summary({ roundTrips: 3 })),
      change(1, summary({ roundTrips: 3 }), summary({ roundTrips: 4 })),
    ]);
    expect(graphClaim(real, apart)).toMatch(/goes from 1 to 3 round trips and .* from 3 to 4/u);
  });

  it('names new operations, one or several, with what the edge keeps', () => {
    const several = diffOf([
      change(0, null, summary()),
      change(1, null, summary()),
      change(2, null, summary()),
    ]);
    expect(graphClaim(real, several)).toMatch(/are new/u);
    expect(graphClaim(real, diffOf([change(0, null, summary())]))).toMatch(/is new$/u);
    const cached = diffOf([change(0, null, summary({ cacheable: true, maxAge: 60 }))]);
    expect(graphClaim(real, cached)).toMatch(/is new and cached at the edge for/u);
  });

  it('says what saves trips only when nothing else is felt', () => {
    const saves = diffOf([change(0, summary({ roundTrips: 3 }), summary())]);
    expect(graphClaim(real, saves)).toMatch(/saves round trips$/u);
    const both = diffOf([
      change(0, summary({ roundTrips: 3 }), summary()),
      change(1, summary({ roundTrips: 3 }), summary()),
    ]);
    expect(graphClaim(real, both)).toMatch(/save round trips$/u);
    expect(graphClaim(real, diffOf([change(0, summary(), summary())]))).toBe('');
  });

  it('keeps the same route in the same place', () => {
    const rows = opImpact(real, diffOf([change(0, summary(), summary())]));
    expect(rows.map((r) => r.kind)).toEqual(['same']);
  });
});

describe('what the owners do', () => {
  const field = base.fields[0];
  if (field === undefined) throw new Error('no field');

  it.each([
    [
      'a removed field',
      { fields: [{ ...field, moved: false, status: 'removed' as const }] },
      'removed',
    ],
    [
      'two removed fields',
      {
        fields: [
          { ...field, moved: false, status: 'removed' as const },
          { ...field, moved: false, status: 'removed' as const },
        ],
      },
      'fields are removed',
    ],
    [
      'a moved field',
      { fields: [{ ...field, moved: true, status: 'modified' as const }] },
      'moves',
    ],
    [
      'a subgraph that joins',
      { subgraphs: [{ id: 'sg:new', status: 'added' as const, summaries: [] }] },
      'joins',
    ],
    [
      'subgraphs that join',
      {
        subgraphs: [
          { id: 'sg:new', status: 'added' as const, summaries: [] },
          { id: 'sg:newer', status: 'added' as const, summaries: [] },
        ],
      },
      'join',
    ],
  ])('says %s in the headline', (_name, over, word) => {
    const shaped = graphChange(modelWith(diffOf([], over)));
    expect(shaped?.headline).toContain(word);
  });

  it('says a route changes when only operations do', () => {
    const shaped = graphChange(modelWith(diffOf([change(0, summary(), summary({ fetches: 2 }))])));
    expect(shaped?.headline).toMatch(/operation/u);
  });

  it('names new operations when nothing else moves and nothing is felt', () => {
    const shaped = graphChange(
      modelWith(diffOf([change(0, null, summary()), change(1, null, summary())])),
    );
    expect(shaped?.headline).toContain('are new');
  });

  it('says the graph changes shape when it cannot say more', () => {
    const shaped = graphChange(modelWith(diffOf([], { caches: base.caches })));
    expect(shaped?.headline).toBe('The graph changes shape.');
  });
});
