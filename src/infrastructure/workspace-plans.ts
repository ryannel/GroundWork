import 'server-only';

import type { Issue } from '@/application/plan/check-context';
import type { BaseInfo } from '@/application/plan/plan-base';
import type { Overlap } from '@/application/plan/plan-stack';
import { checkProgress, issueStatusOf } from '@/application/plan/progress';
import type { Inherited } from '@/application/plan/stack-base';
import type { PlanStanding } from '@/application/plan/work-standing';
import type { ProgressEvent } from '@/domain/model/plan.generated';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import { readStanding } from './plan-standing';
import { checkPlan, listPlans, readOverlaps, readPlan, readProgress } from './plan-store';
import { untilEdited } from './workspace-memo';

/** A plan that passed the schema and its cross-references, with the GitHub state of its work items. */
export interface LoadedPlan {
  readonly slug: string;
  readonly plan: Plan;
  /** The GitHub issue state of each work item: the latest GitHub event in its progress.yaml. */
  readonly status: IssueStatus;
  /** Where the plan's today comes from and whether today has moved under it. */
  readonly base: BaseInfo;
  /** What the plans it builds on added and changed, by id; pass it to derive() as `inherited`. */
  readonly inherited: Inherited;
  /** What its checks warn about, overlaps with other plans among them; empty when read without checking. */
  readonly warnings: readonly Issue[];
  /** The open plans, neither building on the other, that change what this plan changes. */
  readonly overlaps: readonly Overlap[];
  /** Where its work stands (commitment, progress, last heard, blockers) and how far today says what it changes. */
  readonly standing: PlanStanding;
  /** What has happened to its work: progress.yaml's events, oldest first. */
  readonly events: readonly ProgressEvent[];
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

/**
 * The plan at plans/<slug>, loaded or broken; null when there is none. Read once until a file changes. A plan is
 * checked when it is written and before it is committed, so this trusts that check (see `checkPlanState`).
 */
export async function readPlanState(
  workspace: string,
  slug: string,
  root?: string,
): Promise<PlanState | null> {
  return remembered(root, `read\n${workspace}\n${slug}`, async () =>
    stateOf(workspace, slug, root, false),
  );
}

/** The plan at plans/<slug> with every reference checked against the whole of its base, as before a commit. */
export async function checkPlanState(
  workspace: string,
  slug: string,
  root?: string,
): Promise<PlanState | null> {
  return remembered(root, `check\n${workspace}\n${slug}`, async () =>
    stateOf(workspace, slug, root, true),
  );
}

async function stateOf(
  workspace: string,
  slug: string,
  root: string | undefined,
  check: boolean,
): Promise<PlanState | null> {
  const slugs = await listPlans(workspace, root);
  if (!slugs.includes(slug)) return null;
  const {
    plan,
    errors,
    warnings,
    base,
    inherited,
    title: heldBack,
  } = await (check ? checkPlan : readPlan)(workspace, slug, root === undefined ? {} : { root });
  if (plan === null || errors.length > 0) {
    const title = plan?.meta.title ?? heldBack ?? null;
    return { loaded: null, broken: { slug, title, errors, warnings } };
  }
  const read = await readProgress(workspace, slug, root);
  const progressErrors = [...read.errors, ...checkProgress(plan, read.progress)].map((issue) => ({
    path: `progress.yaml: ${issue.path}`,
    message: issue.message,
  }));
  if (progressErrors.length > 0) {
    return {
      loaded: null,
      broken: { slug, title: plan.meta.title, errors: progressErrors, warnings },
    };
  }
  const [all, standing] = await Promise.all([
    readOverlaps(workspace, root),
    readStanding(plan, read.progress, { workspace, root }),
  ]);
  const overlaps = all.filter((each) => each.plans.includes(slug));
  return {
    loaded: {
      slug,
      plan,
      status: issueStatusOf(read.progress),
      base,
      inherited,
      warnings,
      overlaps,
      standing,
      events: read.progress.events,
    },
    broken: null,
  };
}

/** The plan at plans/<slug>, null when there is none or it has errors. */
export async function readLoadedPlan(
  workspace: string,
  slug: string,
  root?: string,
): Promise<LoadedPlan | null> {
  const state = await readPlanState(workspace, slug, root);
  return state?.loaded ?? null;
}

/** The plans that can be shown; a broken one shows its errors on its own page, not in the lists. */
export async function readLoadedPlans(workspace: string, root?: string): Promise<LoadedPlan[]> {
  const slugs = await listPlans(workspace, root);
  const plans = await Promise.all(slugs.map(async (slug) => readLoadedPlan(workspace, slug, root)));
  return plans.filter((plan) => plan !== null);
}
