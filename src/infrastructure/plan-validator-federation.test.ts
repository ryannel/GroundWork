import { describe, expect, it, vi } from 'vitest';

import { byId, shop } from '@/../test/federation-kit';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { checkPlanData } = await import('./plan-validator');
const { listPlans, readPlan } = await import('./plan-store');

async function errorsOf(mutate: (p: Plan) => void): Promise<string[]> {
  const p = shop();
  mutate(p);
  const { errors } = await checkPlanData(p);
  return errors.map((e) => `${e.path}: ${e.message}`);
}

describe('graph-type shape (schema)', () => {
  it('the shop passes the schema and the checks', async () => {
    const r = await checkPlanData(shop());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('every alder-finch plan, the graph plan included, validates with no findings', async () => {
    for (const slug of await listPlans('alder-finch')) {
      const r = await readPlan('alder-finch', slug);
      expect([slug, r.errors, r.warnings]).toEqual([slug, [], []]);
    }
  });

  it('a graph type must name its graph', async () => {
    const errors = await errorsOf((p) => {
      delete byId(p.schemas, 'sch:gql-money').graph;
    });
    expect(errors.some((e) => /schemas\[\d+\]\.graph: is required/.test(e))).toBe(true);
  });

  it('graph-only props stay on graph types', async () => {
    const onField = await errorsOf((p) => {
      byId(p.schemas, 'sch:price').fields![0]!.subgraphs = ['sg:pricing'];
    });
    expect(
      onField.some((e) =>
        e.includes('schemas[1].fields[0].subgraphs: subgraphs belongs to a GraphQL type'),
      ),
    ).toBe(true);
    const onType = await errorsOf((p) => {
      byId(p.schemas, 'sch:price').graph = 'graph:shop';
    });
    expect(onType.some((e) => e.includes('graph belongs to a GraphQL type'))).toBe(true);
  });
});
