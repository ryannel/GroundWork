import 'server-only';

import { derive, type Model } from '@/application/plan/derive';
import { outlineOf, screenParams, type Outline } from '@/application/plan-pages';
import { findWorkspace } from '@/application/workspace-paths';

import { readLoadedPlan, readLoadedPlans } from './workspace-plans';
import { readWorkspaces } from './workspace-store';

export interface PlanParams {
  readonly workspace: string;
  readonly plan: string;
}

export interface PlanData {
  readonly workspaceName: string;
  readonly model: Model;
  readonly outline: Outline;
}

/** Every plan of every workspace, for generateStaticParams. */
export async function planParams(): Promise<PlanParams[]> {
  const workspaces = await readWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async (workspace) => {
      const plans = await readLoadedPlans(workspace.id);
      return plans.map((loaded) => ({ workspace: workspace.id, plan: loaded.slug }));
    }),
  );
  return lists.flat();
}

/** Every screen of every plan except the covers. */
export async function screenPaths(): Promise<(PlanParams & { chapter: string; screen: string })[]> {
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

async function load({ workspace, plan }: PlanParams): Promise<PlanData | null> {
  const found = findWorkspace(await readWorkspaces(), workspace);
  const loaded = found === null ? null : await readLoadedPlan(workspace, plan);
  if (found === null || loaded === null) return null;
  const model = derive(loaded.plan, { status: loaded.status });
  return {
    workspaceName: found.name,
    model,
    outline: outlineOf(model, { workspace, slug: plan }),
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
