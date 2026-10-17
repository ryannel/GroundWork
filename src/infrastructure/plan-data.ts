import 'server-only';

import { derive, type Model } from '@/application/plan/derive';
import type { BaseInfo } from '@/application/plan/plan-base';
import { planCardOf, type PlanCard } from '@/application/plan-footprint';
import { outlineOf, screenParams, type Outline } from '@/application/plan-pages';
import { findWorkspace } from '@/application/workspace-paths';

import { listPlans } from './plan-store';
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
}

/** Every plan of every workspace, for generateStaticParams; a broken one too, so its cover can say what is wrong. */
export async function planParams(): Promise<PlanParams[]> {
  const workspaces = await readWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async (workspace) => {
      const slugs = await listPlans(workspace.id);
      return slugs.map((slug) => ({ workspace: workspace.id, plan: slug }));
    }),
  );
  return lists.flat();
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

/** Every screen of every plan except the covers. */
export async function screenPaths(): Promise<
  (PlanParams & { readonly chapter: string; readonly screen: string })[]
> {
  const params = await planParams();
  const lists = await Promise.all(
    params.map(async (at) => {
      const data = await planData(at);
      return data === null
        ? []
        : screenParams(data.outline).map((screen) => ({ ...at, ...screen }));
    }),
  );
  return lists.flat();
}

const cached = new Map<string, Promise<PlanData | null>>();
const cards = new Map<string, Promise<PlanCard[]>>();

/** The workspace's plans as cards, read once per build. */
async function planCards(workspace: string): Promise<PlanCard[]> {
  const known = cards.get(workspace);
  if (known !== undefined) return known;
  const pending = readLoadedPlans(workspace).then((plans) =>
    plans.map((loaded) => planCardOf(workspace, loaded)),
  );
  cards.set(workspace, pending);
  return pending;
}

async function load({ workspace, plan }: PlanParams): Promise<PlanData | null> {
  const found = findWorkspace(await readWorkspaces(), workspace);
  const loaded = found === null ? null : await readLoadedPlan(workspace, plan);
  if (found === null || loaded === null) return null;
  const model = derive(loaded.plan, { status: loaded.status, today: new Date() });
  return {
    workspaceName: found.name,
    model,
    outline: outlineOf(model, { workspace, slug: plan }),
    plans: await planCards(workspace),
    base: loaded.base,
  };
}

/** A plan worked out once per build, however many of its pages ask. Null for an unknown plan. */
export async function planData(at: PlanParams): Promise<PlanData | null> {
  const key = `${at.workspace}/${at.plan}`;
  const known = cached.get(key);
  if (known !== undefined) return known;
  const pending = load(at);
  cached.set(key, pending);
  return pending;
}
