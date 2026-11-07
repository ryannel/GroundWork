import type { ModelIndex } from '@/application/model-index';
import { modelPlanFootprintOf } from '@/application/model-plan-footprint';
import { latestEvent } from '@/application/plan/progress';
import { planHref } from '@/application/plan-navigation';
import type { Progress } from '@/domain/plan/plan.generated';
import type { ModelGap, ModelPlan } from '@/domain/workspace-model';
import { plural } from '@/shared/text';

export interface ModelSystemPlanInput {
  readonly slug: string;
  readonly plan: ModelPlan;
}
export interface ModelSystemPlanLink {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly href: string;
  readonly workIds: readonly string[];
  readonly progress: string;
}
export interface ModelSystemPlans {
  readonly items: readonly ModelSystemPlanLink[];
  readonly domainPlans: number;
  readonly gaps: readonly ModelGap[];
}
/** Structural footprints select real plans; work is scoped only to recorded repository homes. */
export function modelSystemPlansOf(
  index: ModelIndex,
  system: string,
  entries: readonly ModelSystemPlanInput[],
): ModelSystemPlans {
  const plans = entries.map((entry) => entry.plan);
  const domain = index.place(system)?.domain;
  const repos = new Set(index.codeHomes(system).map((home) => home.repo));
  const footprints = entries.map((entry) => ({
    entry,
    footprint: modelPlanFootprintOf(entry.plan, plans, index),
  }));
  return {
    items: footprints
      .filter(({ footprint }) => footprint.systems.includes(system))
      .map(({ entry }) => ({
        id: entry.plan.meta.id,
        slug: entry.slug,
        title: entry.plan.meta.title,
        href: planHref({ workspace: index.model.id, slug: entry.slug }),
        workIds: (entry.plan.work_items ?? [])
          .filter((item) => item.repo !== undefined && repos.has(item.repo))
          .map((item) => item.id),
        progress: 'Work progress has not been read.',
      })),
    domainPlans: footprints.filter(
      ({ footprint }) =>
        domain !== null && domain !== undefined && footprint.domains.includes(domain),
    ).length,
    gaps: footprints.flatMap(({ footprint }) => footprint.gaps),
  };
}
/** A missing state is unknown; only explicit latest work events can be counted as recorded done. */
export function modelSystemPlanProgress(
  item: ModelSystemPlanLink,
  progress: Progress | null,
  errors: readonly { readonly message: string }[] = [],
): ModelSystemPlanLink {
  if (errors.length > 0) {
    return {
      ...item,
      progress: `Progress could not be read: ${errors.map((error) => error.message).join('; ')}`,
    };
  }
  if (item.workIds.length === 0) {
    return {
      ...item,
      progress: 'No work items are assigned to this system’s recorded repositories.',
    };
  }
  if (progress === null) return item;
  const states = item.workIds.map((id) =>
    latestEvent(progress.events, (event) => event.kind === 'work' && event.subject === id),
  );
  const known = states.filter((state) => state !== null);
  if (known.length === 0) {
    return {
      ...item,
      progress: `No work progress recorded for ${plural(item.workIds.length, 'assigned item')}.`,
    };
  }
  const done = known.filter((state) => state.state === 'done').length;
  const unknown = states.length - known.length;
  const remaining =
    unknown === 0 ? '' : `; ${plural(unknown, 'item')} without a recorded work state`;
  return {
    ...item,
    progress: `${String(done)} of ${plural(item.workIds.length, 'assigned item')} recorded done${remaining}.`,
  };
}
