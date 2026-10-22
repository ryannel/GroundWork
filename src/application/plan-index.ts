import { derive, type Model } from '@/application/plan/derive';
import type { Workspace } from '@/domain/workspace';
import { componentHomes } from '@/domain/workspace-links';
import { clip } from '@/shared/plain-text';

import type { PlanInput } from './plan-footprint';
import { planHref } from './plan-pages';

// Every plan in a workspace as one row of the plans index, for finding one among hundreds: where it lands (the
// domains its changes and work reach), how far it has come, and when it was written. Nothing here is authored.

export type PlanStage = 'draft' | 'review' | 'approved' | 'delivery' | 'done';

export const STAGE_WORDS: Readonly<Record<PlanStage, string>> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  delivery: 'In delivery',
  done: 'Delivered',
};

export interface PlanRow {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  /** The problem in a line or two, as plain words. */
  readonly summary: string;
  readonly stage: PlanStage;
  /** When it was written (YYYY-MM-DD), or null. */
  readonly date: string | null;
  /** The domains it lands in, by id as in the workspace (no `domain:` prefix). */
  readonly domains: readonly string[];
  readonly workItems: number;
  readonly done: number;
}

function stageOf(model: Model, items: number, done: number): PlanStage {
  if (items > 0 && done === items) return 'done';
  if (done > 0) return 'delivery';
  const status = model.plan.meta.status ?? 'draft';
  return status === 'committed' ? 'approved' : status;
}

/** The domains a plan reaches: those holding a component it changes, or a repo its work goes to. */
function domainsOf(workspace: Workspace, model: Model): string[] {
  const homes = componentHomes(workspace.domains);
  const touched = model.records
    .flatMap((record) => record.ids)
    .flatMap((id) => [id, model.ownerService(id)])
    .flatMap((id) => (id === null ? [] : [homes.get(id)?.domain ?? []].flat()));
  const repos = new Set((model.plan.work_items ?? []).flatMap((item) => item.repo ?? []));
  const worked = workspace.domains
    .filter((domain) =>
      domain.systems.some((system) => system.repos.some((r) => repos.has(r.repo))),
    )
    .map((domain) => domain.id);
  const reached = new Set([...touched, ...worked]);
  return workspace.domains.map((d) => d.id).filter((id) => reached.has(id));
}

export function planRowOf(workspace: Workspace, input: PlanInput): PlanRow {
  const model = derive(input.plan, { status: input.status });
  const items = input.plan.work_items ?? [];
  const done = items.filter((item) => model.statusOf(item.id)?.state === 'closed').length;
  return {
    id: input.slug,
    title: input.plan.meta.title,
    href: planHref({ workspace: workspace.id, slug: input.slug }),
    summary: clip(input.plan.problem.summary, (id) => model.label(id), 220),
    stage: stageOf(model, items.length, done),
    date: input.plan.meta.date ?? null,
    domains: domainsOf(workspace, model),
    workItems: items.length,
    done,
  };
}

/** Every plan's row, newest first. */
export function planRowsOf(workspace: Workspace, plans: readonly PlanInput[]): PlanRow[] {
  return plans
    .map((plan) => planRowOf(workspace, plan))
    .toSorted((a, b) => {
      const byDate = (b.date ?? '').localeCompare(a.date ?? '');
      return byDate === 0 ? a.title.localeCompare(b.title) : byDate;
    });
}

/** The plans that reach one domain, newest first. */
export function domainPlanRowsOf(
  workspace: Workspace,
  plans: readonly PlanInput[],
  domain: string,
): PlanRow[] {
  return planRowsOf(workspace, plans).filter((row) => row.domains.includes(domain));
}
