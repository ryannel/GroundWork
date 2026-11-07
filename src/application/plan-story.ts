import { hasPrefix } from '@/domain/ids';
import type { ModelPlan } from '@/domain/workspace-model';

import type { ModelIndex } from './model-index';

interface StoryReference {
  readonly id: string;
  readonly at: string;
}
interface PlanStoryProblem {
  readonly at: string;
  readonly message: string;
}
type StoryStage = NonNullable<NonNullable<ModelPlan['story']>['stages']>[number];
function references(ids: readonly string[], at: string): readonly StoryReference[] {
  return ids.map((id, position) => ({ id, at: `${at}/${String(position)}` }));
}
function stageReferences(stage: StoryStage, at: string): readonly StoryReference[] {
  return [
    ...stage.components.flatMap((component, position) => {
      const location = `${at}/components/${String(position)}`;
      return [
        { id: component.component, at: `${location}/component` },
        ...references(component.from ?? [], `${location}/from`),
      ];
    }),
    ...references(stage.flows ?? [], `${at}/flows`),
  ];
}
function storyReferences(plan: ModelPlan): readonly StoryReference[] {
  const location = `${plan.meta.id}/story`;
  return [
    ...references(plan.story?.scope ?? [], `${location}/scope`),
    ...references(plan.story?.concepts ?? [], `${location}/concepts`),
    ...(plan.story?.stages ?? []).flatMap((stage, position) =>
      stageReferences(stage, `${location}/stages/${String(position)}`),
    ),
  ];
}
/** Story metadata selects known model facts or local stages; it never declares execution edges. */
export function planStoryProblems(
  plan: ModelPlan,
  before: ModelIndex,
  after: ModelIndex,
): readonly PlanStoryProblem[] {
  const stages = new Set((plan.story?.stages ?? []).map((stage) => stage.id));
  return storyReferences(plan).flatMap(({ id, at }) => {
    const known = hasPrefix(id, 'stage')
      ? stages.has(id)
      : before.get(id) !== null || after.get(id) !== null;
    return known ? [] : [{ at, message: `Unresolved plan story reference: ${id}.` }];
  });
}
