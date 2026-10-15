import { derive, type Model } from '@/application/plan/derive';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import { componentHomes } from '@/domain/workspace-links';
import { plural } from '@/shared/text';

import { planHref } from './plan-pages';

// Where a plan lands in a workspace. A system is touched when a change reaches one of its components, or when a
// work item goes to one of its repos. Nothing here is authored: it is read off the plan's changes and work items.

export interface PlanInput {
  readonly slug: string;
  readonly plan: Plan;
  readonly status: IssueStatus;
}

/** One plan's part for a system. */
export interface PlanPart {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly workItems: number;
  readonly done: number;
}

/** A plan as a card on its workspace's landscape. */
export interface PlanCard {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly stage: string;
}

const STAGES = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  committed: 'Committed',
} as const;

function stageOf(model: Model): string {
  const items = model.plan.work_items ?? [];
  const done = items.filter((item) => model.statusOf(item.id)?.state === 'closed').length;
  if (items.length > 0 && done > 0) {
    return `In delivery · ${String(done)} of ${plural(items.length, 'work item')} done`;
  }
  return STAGES[model.plan.meta.status ?? 'draft'];
}

export function planCardOf(workspace: string, input: PlanInput): PlanCard {
  const model = derive(input.plan, { status: input.status });
  return {
    id: input.slug,
    title: input.plan.meta.title,
    href: planHref({ workspace, slug: input.slug }),
    stage: stageOf(model),
  };
}

function componentsTouched(model: Model, systemId: string, workspace: Workspace): string[] {
  const homes = componentHomes(workspace.domains);
  const touched = model.records
    .flatMap((record) => record.ids)
    .flatMap((id) => [id, model.ownerService(id)])
    .filter((id): id is string => id !== null && homes.get(id)?.system === systemId);
  return [...new Set(touched)];
}

/** The plans that land on one system, with the work going to its repos. */
export function partsFor(
  workspace: Workspace,
  system: { readonly domain: string; readonly system: string },
  plans: readonly PlanInput[],
): PlanPart[] {
  const found = workspace.domains
    .find((domain) => domain.id === system.domain)
    ?.systems.find((candidate) => candidate.id === system.system);
  if (found === undefined) return [];
  return plans.flatMap((input) => {
    const model = derive(input.plan, { status: input.status });
    const touches = componentsTouched(model, found.id, workspace);
    const items = (input.plan.work_items ?? []).filter(
      (item) => item.repo !== undefined && found.repos.includes(item.repo),
    );
    if (touches.length === 0 && items.length === 0) return [];
    return [
      {
        id: input.slug,
        title: input.plan.meta.title,
        href: planHref({ workspace: workspace.id, slug: input.slug }),
        workItems: items.length,
        done: items.filter((item) => model.statusOf(item.id)?.state === 'closed').length,
      },
    ];
  });
}
