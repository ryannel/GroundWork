import 'server-only';

import type { Issue } from '@/application/plan/check-context';
import type { ShapeCheck } from '@/application/plan/check-shape';
import { isRecord } from '@/application/plan/ids';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { Neighbours } from '@/domain/plan/plan-neighbours';
import type { Plan } from '@/domain/plan/plan.generated';

import { planSchema } from './plan-schema';
import { rewriteErrors, shapeProblems } from './plan-schema-errors';

export { planDef } from './plan-schema';
export { defProblems } from './plan-schema-errors';

/** What loading a plan found. `plan` is null when the schema rejected it. */
export interface PlanCheck {
  readonly plan: Plan | null;
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
}

/**
 * Plan data against the schema alone, without the cross-references: how a plan that was checked when it was
 * written is read, so its pages can rely on its shape.
 */
export async function shapePlanData(data: unknown): Promise<PlanCheck> {
  if (!isRecord(data)) {
    return {
      plan: null,
      errors: [{ path: '(root)', message: 'plan must be a YAML mapping' }],
      warnings: [],
    };
  }
  const { root, def } = await planSchema();
  const isPlan = root<Plan>();
  if (isPlan(data)) return { plan: data, errors: [], warnings: [] };
  const errors = rewriteErrors(isPlan.errors ?? [], data, { branchOf: def });
  return { plan: null, errors, warnings: [] };
}

/**
 * Validate parsed plan data against the schema, then (when the shape is right) the cross-references, resolving
 * what it names in other plans and programmes against `neighbours` when given.
 */
export async function checkPlanData(
  data: unknown,
  fanout?: Fanout,
  neighbours?: Neighbours,
): Promise<PlanCheck> {
  const shaped = await shapePlanData(data);
  if (shaped.plan === null) return shaped;
  const { def } = await planSchema();
  const shape: ShapeCheck = (type, entity) => {
    const check = def(type);
    return check === undefined || check(entity) ? [] : shapeProblems(check.errors ?? []);
  };
  return { plan: shaped.plan, ...validatePlan(shaped.plan, { fanout, shape, neighbours }) };
}
