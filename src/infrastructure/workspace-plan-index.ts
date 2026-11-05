import 'server-only';
import {
  type WorkspacePlanIndex,
  workspacePlanIndexOf,
} from '@/application/workspace-work/workspace-plan-index';
import { hasPrefix } from '@/domain/ids';
import type { Programme } from '@/domain/plan/plan.generated';

import { readToday } from './today-model';
import { untilEdited } from './workspace-memo';
import { readLoadedPlans } from './workspace-plans';
import { readProgrammes } from './workspace-programmes';

// Every plan of a workspace, read once into one index until a file changes: the pages about many plans (a stacked
// plan's cover, a partner, a programme, what a team or system has coming) project from it.

const remembered = untilEdited<WorkspacePlanIndex | null>();

/** The system each thing in today's model belongs to: a system itself, else the system of the component holding it. */
function systemsOfToday(today: NonNullable<Awaited<ReturnType<typeof readToday>>>['today']) {
  const { plan, model } = today;
  const systemOfService = new Map(
    plan.services.flatMap((s) => (s.system === undefined ? [] : [[s.id, s.system] as const])),
  );
  return (id: string): string | null => {
    if (hasPrefix(id, 'sys')) return id;
    const service = model.ownerService(id) ?? id;
    return systemOfService.get(service) ?? null;
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
      systemOf: systemsOfToday(found.today),
    });
  });
}
