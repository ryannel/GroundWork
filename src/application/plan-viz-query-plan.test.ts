// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { planFacts, planOf, roundsOf, selectionOf, WHY } from '@/application/plan-viz-query-plan';

vi.mock('server-only', () => ({}));

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'storefront-graph');
  return derive(loaded.plan!);
}

const OP = 'gql:product-page';

describe('the query plan of an operation', () => {
  it('lists the fetches in rounds', async () => {
    const model = await load();
    const plan = planOf(model, OP)!;
    expect(roundsOf(plan).flat()).toHaveLength(plan.fetches.length);
    expect(planFacts(model, OP)).toMatch(/Fetch|Parallel/u);
    expect(planFacts(model, OP, 'asIs')).toBeTypeOf('string');
  });

  it('is empty for an unknown operation', async () => {
    const model = await load();
    expect(planOf(model, 'gql:nothing')).toBeNull();
    expect(planFacts(model, 'gql:nothing')).toBe('');
  });

  it('nests each fetch selection below where it folds in', async () => {
    const model = await load();
    const plan = planOf(model, OP)!;
    for (const f of plan.fetches) {
      const names = selectionOf(plan, f);
      expect(names.length).toBeGreaterThan(0);
    }
    expect(WHY.key).toContain('key');
    expect(WHY.requires).toContain('@requires');
  });
});
