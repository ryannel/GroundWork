import 'server-only';

import type { Issue } from '@/application/plan/check-context';
import { checkProgramme } from '@/application/plan/check-programme';
import type { Programme } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';

import { readNeighbourIndex } from './plan-store';
import { defProblems, planDef } from './plan-validator';
import { listProgrammes, readProgrammeRaw } from './programme-store';

/** A programme as read: the programme when it passed its checks, and what is wrong with it. */
export interface ProgrammeRead {
  readonly id: string;
  readonly programme: Programme | null;
  readonly errors: readonly Issue[];
}

/** Read and check programmes/<id>/programme.yaml: the schema, then its ids, teams and citations. */
export async function readProgramme(
  workspace: Workspace,
  id: string,
  root?: string,
): Promise<ProgrammeRead> {
  const raw = await readProgrammeRaw(workspace.id, id, root);
  if ('error' in raw) return { id, programme: null, errors: [raw.error] };
  const check = await planDef<Programme>('programme');
  if (!check(raw.data)) {
    const errors = defProblems(check).map((message) => ({ path: '(root)', message }));
    return { id, programme: null, errors };
  }
  const index = await readNeighbourIndex(workspace.id, root);
  const errors = checkProgramme(raw.data, {
    folder: id,
    teams: new Set(workspace.teams.map((team) => team.id)),
    neighbours: { slug: id, ...index },
  });
  return { id, programme: errors.length > 0 ? null : raw.data, errors };
}

/** Every programme of the workspace, read and checked. */
export async function readProgrammes(
  workspace: Workspace,
  root?: string,
): Promise<readonly ProgrammeRead[]> {
  const ids = await listProgrammes(workspace.id, root);
  return Promise.all(ids.map(async (id) => readProgramme(workspace, id, root)));
}
