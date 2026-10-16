import 'server-only';

import { planCardOf, type PlanCard } from '@/application/plan-footprint';
import { type SystemModel, systemModelOf } from '@/application/workspace-model';
import { findWorkspace } from '@/application/workspace-paths';
import type { Workspace } from '@/domain/workspace';

import { readWorkspaceModel } from './workspace-model';
import { readLoadedPlans } from './workspace-plans';
import { readWorkspaces } from './workspace-store';

export interface TodayData {
  readonly workspace: Workspace;
  /** How the workspace's systems work today, as a plan-shaped document and its Model. */
  readonly today: SystemModel;
  readonly plans: readonly PlanCard[];
}

const cache = new Map<string, Promise<TodayData | null>>();

/** A workspace as it runs today, read once per build. Null when there is no such workspace. */
export async function todayData(id: string): Promise<TodayData | null> {
  const known = cache.get(id);
  if (known !== undefined) return known;
  const reading = readToday(id);
  cache.set(id, reading);
  return reading;
}

async function readToday(id: string): Promise<TodayData | null> {
  const workspace = findWorkspace(await readWorkspaces(), id);
  if (workspace === null) return null;
  const today = systemModelOf(workspace, await readWorkspaceModel(workspace));
  const loaded = await readLoadedPlans(workspace.id);
  return { workspace, today, plans: loaded.map((plan) => planCardOf(workspace.id, plan)) };
}
