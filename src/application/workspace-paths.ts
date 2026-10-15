import type { Team, Workspace } from '@/domain/workspace';

export function workspaceHref(workspace: string): string {
  return `/${workspace}/`;
}

export function domainHref(workspace: string, domain: string): string {
  return `/${workspace}/${domain}/`;
}

export function systemHref(options: { workspace: string; domain: string; system: string }): string {
  return `/${options.workspace}/${options.domain}/${options.system}/`;
}

export function teamOf(workspace: Workspace, id: string | null): Team | null {
  return workspace.teams.find((team) => team.id === id) ?? null;
}

/** Every domain, for the static routes. */
export function domainPaths(workspaces: readonly Workspace[]) {
  return workspaces.flatMap((workspace) =>
    workspace.domains.map((domain) => ({ workspace: workspace.id, domain: domain.id })),
  );
}

/** Every system, for the static routes. */
export function systemPaths(workspaces: readonly Workspace[]) {
  return workspaces.flatMap((workspace) =>
    workspace.domains.flatMap((domain) =>
      domain.systems.map((system) => ({
        workspace: workspace.id,
        domain: domain.id,
        system: system.id,
      })),
    ),
  );
}

export function findWorkspace(workspaces: readonly Workspace[], id: string): Workspace | null {
  return workspaces.find((workspace) => workspace.id === id) ?? null;
}
