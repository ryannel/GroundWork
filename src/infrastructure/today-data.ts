import 'server-only';

import { planCardOf, type PlanCard } from '@/application/plan-footprint';

import { listProgrammes } from './programme-store';
import { readToday, type Today } from './today-model';
import { untilEdited } from './workspace-memo';
import { readLoadedPlans } from './workspace-plans';

export interface TodayData extends Today {
  readonly plans: readonly PlanCard[];
  /** The ids of its programmes, for the rail to count. */
  readonly programmes: readonly string[];
}

const remembered = untilEdited<TodayData | null>();

/** A workspace as it runs today, read once until a file changes. Null when there is no such workspace. */
export async function todayData(id: string): Promise<TodayData | null> {
  return remembered(undefined, id, async () => {
    const found = await readToday(id);
    if (found === null) return null;
    const [loaded, programmes] = await Promise.all([
      readLoadedPlans(found.workspace.id),
      listProgrammes(found.workspace.id),
    ]);
    return {
      ...found,
      plans: loaded.map((plan) => planCardOf(found.workspace.id, plan)),
      programmes,
    };
  });
}
