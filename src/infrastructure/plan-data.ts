import 'server-only';

import { derive, type Model } from '@/application/plan/derive';
import type { BaseInfo } from '@/application/plan/plan-base';
import { planCardOf, type PlanCard } from '@/application/plan-footprint';
import { outlineOf, type Outline } from '@/application/plan-pages';
import { findWorkspace } from '@/application/workspace-paths';
import { stackCoverVM, type StackCoverVM } from '@/application/workspace-work/stack-cover';

import { readPlacementData } from './today-model';
import { untilEdited } from './workspace-memo';
import { readWorkspacePlanIndex } from './workspace-plan-index';
import { readLoadedPlan, readLoadedPlans, readPlanState, type BrokenPlan } from './workspace-plans';
import { readWorkspaces } from './workspace-store';

export interface PlanParams {
  readonly workspace: string;
  readonly plan: string;
}

export interface PlanData {
  readonly workspaceName: string;
  readonly model: Model;
  readonly outline: Outline;
  /** Every plan of the workspace, for the plan switcher. */
  readonly plans: readonly PlanCard[];
  /** Where the plan's today comes from, and whether today has moved under it. */
  readonly base: BaseInfo;
  /** The plans it reads after, overlaps and joins, for the cover; null when there are none. */
  readonly stack: StackCoverVM | null;
}

export interface PlanFailure extends BrokenPlan {
  readonly workspace: string;
  readonly workspaceName: string;
}

/** What stops a plan being shown, or null when it can be (or there is no such plan). */
export async function planFailure({ workspace, plan }: PlanParams): Promise<PlanFailure | null> {
  const found = findWorkspace(await readWorkspaces(), workspace);
  const state = found === null ? null : await readPlanState(workspace, plan);
  const broken = state?.broken ?? null;
  if (found === null || broken === null) return null;
  return { ...broken, workspace, workspaceName: found.name };
}

const remembered = untilEdited<PlanData | null>(() => new Date().toISOString().slice(0, 10));
const cards = untilEdited<PlanCard[]>();

/** The workspace's plans as cards, read once until a file changes. */
async function planCards(workspace: string): Promise<PlanCard[]> {
  return cards(undefined, workspace, async () => {
    const plans = await readLoadedPlans(workspace);
    return plans.map((loaded) => planCardOf(workspace, loaded));
  });
}

async function load({ workspace, plan }: PlanParams): Promise<PlanData | null> {
  const found = findWorkspace(await readWorkspaces(), workspace);
  const loaded = found === null ? null : await readLoadedPlan(workspace, plan);
  if (found === null || loaded === null) return null;
  const model = derive(loaded.plan, {
    placements: loaded.base.mode === 'live' ? await readPlacementData(workspace) : {},
    status: loaded.status,
    today: new Date(),
    inherited: loaded.inherited,
    standing: loaded.standing,
  });
  const [plans, index] = await Promise.all([
    planCards(workspace),
    readWorkspacePlanIndex(workspace),
  ]);
  return {
    workspaceName: found.name,
    model,
    outline: outlineOf(model, { workspace, slug: plan }),
    plans,
    base: loaded.base,
    stack: index === null ? null : stackCoverVM(index, plan, loaded.base),
  };
}

/** A plan worked out once per day or file edit, however many of its pages ask. Null for an unknown plan. */
export async function planData(at: PlanParams): Promise<PlanData | null> {
  return remembered(undefined, `${at.workspace}/${at.plan}`, async () => load(at));
}
