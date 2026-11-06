import 'server-only';
import {
  type WorkspacePlanIndex,
  workspacePlanIndexOf,
} from '@/application/workspace-work/workspace-plan-index';
import type { Programme } from '@/domain/plan/plan.generated';

import { readToday } from './today-model';
import { untilEdited } from './workspace-memo';
import { readLoadedPlans } from './workspace-plans';
import { readProgrammes } from './workspace-programmes';

// Every plan of a workspace, read once into one index until a file changes: the pages about many plans (a stacked
// plan's cover, a partner, a programme, what a team or system has coming) project from it.

const remembered = untilEdited<WorkspacePlanIndex | null>();

/** Cross-system flows touch their recorded participants; placement still belongs to each component. */
function systemsOfToday(today: NonNullable<Awaited<ReturnType<typeof readToday>>>['today']) {
  return (id: string): readonly string[] => {
    const node = today.model.asIs.get(id);
    const participants =
      node?.$type === 'flow' ? node.steps.flatMap((step) => [step.from, step.to]) : [id];
    return [
      ...new Set(
        participants.flatMap((participant) => {
          const system = today.model.place(participant)?.system;
          return system === undefined || system === null ? [] : [system];
        }),
      ),
    ];
  };
}

/** The workspace's plans as one index; null for a workspace there is none of. */
export async function readWorkspacePlanIndex(
  workspace: string,
  root?: string,
): Promise<WorkspacePlanIndex | null> {
  return remembered(root, `plan-index\n${workspace}`, async () => {
    const found = await readToday(workspace, root);
    if (found === null) return null;
    const [plans, programmes] = await Promise.all([
      readLoadedPlans(workspace, root),
      readProgrammes(found.workspace, root),
    ]);
    return workspacePlanIndexOf({
      workspace,
      plans: plans.map((loaded) => ({
        slug: loaded.slug,
        plan: loaded.plan,
        standing: loaded.standing,
        events: loaded.events,
        status: loaded.status,
        base: loaded.base,
        inherited: loaded.inherited,
        overlaps: loaded.overlaps,
      })),
      programmes: programmes.flatMap((read): Programme[] =>
        read.programme === null ? [] : [read.programme],
      ),
      teams: found.workspace.teams.map((team) => ({
        id: team.id,
        name: team.name,
        partner: team.partner === true,
        contacts: (team.contacts ?? []).map((c) => ({ name: c.name, role: c.role })),
      })),
      systemsOf: systemsOfToday(found.today),
    });
  });
}
