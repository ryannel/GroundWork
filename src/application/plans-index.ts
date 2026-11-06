// Plans are indexed separately: querying today's systems never needs a plan overlay.
import { appendChild, isQualifiedId } from '@/domain/ids';
import { apply } from '@/domain/plan-apply';
import {
  modelRecord,
  type ModelEntity,
  type ModelPlan,
  type WorkspaceModel,
} from '@/domain/workspace-model';

import { indexOf, type ModelIndex } from './model-index';

export interface ProposedEffect {
  readonly id: string;
  readonly plan: string;
  readonly change: string;
  readonly op: number;
}
export interface IndexedPlan {
  readonly proposals: readonly ProposedEffect[];
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
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, position) => sameValue(item, right[position]))
    );
  }
  const a = modelRecord(left);
  const b = modelRecord(right);
  if (a === null || b === null) return false;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
  );
}
function operationTarget(op: NonNullable<ModelPlan['changes'][number]['ops']>[number]): string {
  if ('add' in op) {
    return isQualifiedId(op.value.id) ? op.value.id : appendChild(op.into ?? '', op.value.id);
  }
  if ('modify' in op) return op.modify;
  return 'remove' in op ? op.remove : op.deprecate;
}
function proposalEffects(
  plan: ModelPlan,
  before: ModelIndex,
  after: ModelIndex,
): readonly ProposedEffect[] {
  const changed = after.entities.filter(
    (node) =>
      node.kind === 'step' &&
      ['read', 'write', 'call', 'publish', 'wait', 'return'].some(
        (key) => node.data[key] !== undefined,
      ) &&
      !sameValue(before.get(node.id)?.data, node.data),
  );
  const attributed = (target: string, node: ModelEntity): boolean =>
    contains(after, target, node.id) || isDescendant(node, target, after);
  return plan.changes.flatMap((change) =>
    (change.ops ?? []).flatMap((op, position) =>
      changed
        .filter((node) => attributed(operationTarget(op), node))
        .map((node) => ({ id: node.id, plan: plan.meta.id, change: change.id, op: position })),
    ),
  );
}
function isDescendant(node: ModelEntity, target: string, index: ModelIndex): boolean {
  let parent = node.parent;
  while (parent !== null) {
    if (parent === target) return true;
    parent = index.get(parent)?.parent ?? null;
  }
  return false;
}
/** Each overlay starts from the supplied model; plans do not silently accumulate. */
export function plansIndex(plans: readonly ModelPlan[], model: WorkspaceModel): PlansIndex {
  const beforeIndex = indexOf(model);
  const indexed = plans.map((plan): IndexedPlan => {
    const applied = apply(
      plan.changes.flatMap((change) => change.ops ?? []),
      model,
    );
    const proposals = proposalEffects(plan, beforeIndex, indexOf(applied));
    const after = {
      ...applied,
      problems: [
        ...applied.problems,
        ...proposals.map((proposal) => ({
          id: proposal.id,
          kind: 'proposed_effect',
          message: `Proposed by ${proposal.plan}, ${proposal.change} (op ${String(proposal.op + 1)}); implementation is unverified. Citations provide source context.`,
        })),
      ],
    };
    return { plan, before: model, after, proposals, beforeIndex, afterIndex: indexOf(after) };
  });
  return { plans: indexed, plansTouching: (id) => indexed.filter((plan) => touches(plan, id)) };
}
