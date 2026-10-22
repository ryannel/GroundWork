import 'server-only';

import { planCardOf, type PlanCard } from '@/application/plan-footprint';

import { readToday, type Today } from './today-model';
import { untilEdited } from './workspace-memo';
import { readLoadedPlans } from './workspace-plans';

export interface TodayData extends Today {
  readonly plans: readonly PlanCard[];
}

const remembered = untilEdited<TodayData | null>();

/** A workspace as it runs today, read once until a file changes. Null when there is no such workspace. */
export async function todayData(id: string): Promise<TodayData | null> {
  return remembered(undefined, id, async () => {
    const found = await readToday(id);
    if (found === null) return null;
    const loaded = await readLoadedPlans(found.workspace.id);
    return { ...found, plans: loaded.map((plan) => planCardOf(found.workspace.id, plan)) };
  });
}
