import type { ModelIndex } from '@/application/model-index';
import { modelPlanDomainsOf } from '@/application/model-plan-footprint';
import type { ModelPlanProgress } from '@/application/model-progress';
import { checkStateOf, type PlanRow, type PlanStage } from '@/application/plan-list';
import { planHref } from '@/application/plan-navigation';
import { clip } from '@/domain/plain-text';
import type { ModelGap, ModelPlan } from '@/domain/workspace-model';

export interface ModelPlanRowInput {
  readonly slug: string;
  readonly plan: ModelPlan;
  readonly progress: ModelPlanProgress;
  readonly base: {
    readonly mode: 'live' | 'landed';
    readonly checkedOn: string | null;
    readonly previousCheckedOn?: string;
    readonly edited: boolean;
  };
}
function stageOf(plan: ModelPlan, total: number, done: number): PlanStage {
  if (total > 0 && done === total) return 'done';
  if (done > 0) return 'delivery';
  const status = plan.meta.status ?? 'draft';
  return status === 'committed' ? 'approved' : status;
}
/** List rows count observed closed issues, retaining missing progress and placement as explicit gaps. */
export function modelPlanRowsOf(
  index: ModelIndex,
  entries: readonly ModelPlanRowInput[],
): { readonly rows: readonly PlanRow[]; readonly gaps: readonly ModelGap[] } {
  const plans = entries.map(({ plan }) => plan);
  const gaps: ModelGap[] = [];
  const rows = entries
    .map(({ slug, plan, progress, base }): PlanRow => {
      const work = plan.work_items ?? [];
      const done = work.filter((item) => progress.status[item.id]?.state === 'closed').length;
      const unknown = work.filter((item) => progress.status[item.id] === undefined).length;
      const footprint = modelPlanDomainsOf(plan, plans, index);
      gaps.push(
        ...footprint.gaps,
        ...progress.errors.map((error) => ({
          id: plan.meta.id,
          kind: 'progress_read_error',
          message: `${error.path}: ${error.message}`,
        })),
      );
      return {
        id: slug,
        title: plan.meta.title,
        href: planHref({ workspace: index.model.id, slug }),
        summary: clip(plan.problem.summary, index.label, 220),
        stage: stageOf(plan, work.length, done),
        date: plan.meta.date ?? null,
        domains: footprint.domains,
        workItems: work.length,
        done,
        programme: plan.meta.programme ?? null,
        check: checkStateOf(base),
        ...(base.previousCheckedOn === undefined
          ? {}
          : { previousCheckedOn: base.previousCheckedOn }),
        progressUnknown: unknown,
      };
    })
    .toSorted((a, b) => {
      const date = (b.date ?? '').localeCompare(a.date ?? '');
      return date === 0 ? a.title.localeCompare(b.title) : date;
    });
  return { rows, gaps };
}
