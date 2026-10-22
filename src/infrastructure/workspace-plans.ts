import 'server-only';

import type { Issue } from '@/application/plan/check-context';
import type { BaseInfo } from '@/application/plan/plan-base';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import { listPlans, readPlan, readStatus } from './plan-store';
import { untilEdited } from './workspace-memo';

/** A plan that passed the schema and its cross-references, with the GitHub state of its work items. */
export interface LoadedPlan {
  readonly slug: string;
  readonly plan: Plan;
  readonly status: IssueStatus;
  /** Where the plan's today comes from and whether today has moved under it. */
  readonly base: BaseInfo;
}

/** A plan that is there but cannot be shown: what is wrong, each naming its place in plan.yaml. */
export interface BrokenPlan {
  readonly slug: string;
  readonly title: string | null;
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
}

export type PlanState =
  | { readonly loaded: LoadedPlan; readonly broken: null }
  | { readonly loaded: null; readonly broken: BrokenPlan };

const remembered = untilEdited<PlanState | null>();

/** The plan at plans/<slug>, loaded or broken; null when there is none. Read once until a file changes. */
export async function readPlanState(
  workspace: string,
  slug: string,
  root?: string,
): Promise<PlanState | null> {
  return remembered(root, `${workspace}\n${slug}`, async () => readState(workspace, slug, root));
}

async function readState(
  workspace: string,
  slug: string,
  root: string | undefined,
): Promise<PlanState | null> {
  const slugs = await listPlans(workspace, root);
  if (!slugs.includes(slug)) return null;
  const {
    plan,
    errors,
    warnings,
    base,
    title: heldBack,
  } = await readPlan(workspace, slug, root === undefined ? {} : { root });
  if (plan === null || errors.length > 0) {
    const title = plan?.meta.title ?? heldBack ?? null;
    return { loaded: null, broken: { slug, title, errors, warnings } };
  }
  return {
    loaded: { slug, plan, status: await readStatus(workspace, slug, root), base },
    broken: null,
  };
}

/** The plan at plans/<slug>, null when there is none or it has errors. */
export async function readLoadedPlan(workspace: string, slug: string): Promise<LoadedPlan | null> {
  const state = await readPlanState(workspace, slug);
  return state?.loaded ?? null;
}

/** The plans that can be shown; a broken one shows its errors on its own page, not in the lists. */
export async function readLoadedPlans(workspace: string): Promise<LoadedPlan[]> {
  const slugs = await listPlans(workspace);
  const plans = await Promise.all(slugs.map(async (slug) => readLoadedPlan(workspace, slug)));
  return plans.filter((plan) => plan !== null);
}
