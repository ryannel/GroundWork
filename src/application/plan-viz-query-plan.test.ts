// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { modelOf } from '@/../test/plan-kit';
import { planFacts, planOf, roundsOf, selectionOf, WHY } from '@/application/plan-viz-query-plan';

const load = () => modelOf(shop());

const OP = 'gql:product-page';

describe('the query plan of an operation', () => {
  it('lists the fetches in rounds', () => {
    const model = load();
    const plan = planOf(model, OP)!;
    expect(plan.fetches).toHaveLength(4);
    expect(roundsOf(plan).flat()).toHaveLength(plan.fetches.length);
    expect(planFacts(model, OP)).toMatch(/Fetch|Parallel/u);
    expect(planFacts(model, OP, 'asIs')).toBeTypeOf('string');
  });

  it('is empty for an unknown operation', () => {
    const model = load();
    expect(planOf(model, 'gql:nothing')).toBeNull();
    expect(planFacts(model, 'gql:nothing')).toBe('');
  });

  it('nests each fetch selection below where it folds in', () => {
    const model = load();
    const plan = planOf(model, OP)!;
    for (const f of plan.fetches) {
      const names = selectionOf(plan, f);
      expect(names.length).toBeGreaterThan(0);
    }
    expect(WHY.key).toContain('key');
    expect(WHY.requires).toContain('@requires');
  });
});
