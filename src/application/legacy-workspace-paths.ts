import { buildId } from '@/domain/ids';
import type { Team, Workspace } from '@/domain/workspace';

import { systemHref } from './workspace-paths';

export function teamOf(workspace: Workspace, id: string | null): Team | null {
  return workspace.teams.find((team) => team.id === id) ?? null;
}

export function findWorkspace(workspaces: readonly Workspace[], id: string): Workspace | null {
  return workspaces.find((workspace) => workspace.id === id) ?? null;
}

/** Each system's page, by its `sys:` id, for the inspector to open. */
export function systemPagesOf(workspace: Workspace): Record<string, string> {
  return Object.fromEntries(
    workspace.domains.flatMap((domain) =>
      domain.systems.map((system) => [
        buildId('sys', system.id),
        systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      ]),
    ),
  );
}
