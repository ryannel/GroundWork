import 'server-only';

import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import { listPlans, readPlan, readStatus } from './plan-store';

/** A plan that passed the schema, with the GitHub state of its work items. */
export interface LoadedPlan {
  readonly slug: string;
  readonly plan: Plan;
  readonly status: IssueStatus;
}

/** The plan at plans/<slug>, null when there is none. A plan the schema rejects stops the build. */
export async function readLoadedPlan(workspace: string, slug: string): Promise<LoadedPlan | null> {
  const slugs = await listPlans(workspace);
  if (!slugs.includes(slug)) return null;
  const { plan, errors } = await readPlan(workspace, slug);
  if (plan === null) {
    const found = errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`${workspace}/plans/${slug}/plan.yaml is not a valid plan: ${found}`);
  }
  return { slug, plan, status: await readStatus(workspace, slug) };
}

export async function readLoadedPlans(workspace: string): Promise<LoadedPlan[]> {
  const slugs = await listPlans(workspace);
  const plans = await Promise.all(slugs.map(async (slug) => readLoadedPlan(workspace, slug)));
  return plans.filter((plan) => plan !== null);
}
