// Plans are indexed separately: querying today's systems never needs a plan overlay.
import { apply } from '@/domain/plan-apply';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { indexOf, type ModelIndex } from './model-index';

export interface IndexedPlan {
  readonly plan: ModelPlan;
  readonly before: WorkspaceModel;
  readonly after: WorkspaceModel;
  readonly beforeIndex: ModelIndex;
  readonly afterIndex: ModelIndex;
}
export interface PlansIndex {
  readonly plans: readonly IndexedPlan[];
  readonly plansTouching: (id: string) => readonly IndexedPlan[];
}
function contains(index: ModelIndex, target: string, id: string): boolean {
  if (target === id) return true;
  let node = index.get(target);
  if (node?.place.component === id) return true;
  while (node !== null) {
    if (node.id === id) return true;
    node = node.parent === null ? null : index.get(node.parent);
  }
  return false;
}
function touches(plan: IndexedPlan, id: string): boolean {
  const ops = plan.plan.changes.flatMap((change) => change.ops ?? []);
  const affects = (target: string): boolean =>
    contains(plan.beforeIndex, target, id) || contains(plan.afterIndex, target, id);
  return ops.some((op) => {
    if ('add' in op) return (op.into !== undefined && affects(op.into)) || affects(op.value.id);
    if ('modify' in op) return affects(op.modify);
    return 'remove' in op ? affects(op.remove) : affects(op.deprecate);
  });
}
/** Each overlay starts from the supplied model; plans do not silently accumulate. */
export function plansIndex(plans: readonly ModelPlan[], model: WorkspaceModel): PlansIndex {
  const beforeIndex = indexOf(model);
  const indexed = plans.map((plan): IndexedPlan => {
    const after = apply(
      plan.changes.flatMap((change) => change.ops ?? []),
      model,
    );
    return { plan, before: model, after, beforeIndex, afterIndex: indexOf(after) };
  });
  return { plans: indexed, plansTouching: (id) => indexed.filter((plan) => touches(plan, id)) };
}
