import type { Team, Workspace } from '@/domain/workspace';

export function workspaceHref(workspace: string): string {
  return `/${workspace}/`;
}

export const languageHref = (workspace: string): string => `/${workspace}/language/`;

export const peopleHref = (workspace: string): string => `/${workspace}/people/`;

export const plansHref = (workspace: string): string => `/${workspace}/plans/`;

export function domainHref(workspace: string, domain: string): string {
  return `/${workspace}/${domain}/`;
}

export function systemHref(options: {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
}): string {
  return `/${options.workspace}/${options.domain}/${options.system}/`;
}

/** A flow's part of its address: its id without the `flow:` every flow id starts with. */
export function flowSlug(id: string): string {
  return id.replace(/^flow:/u, '');
}

export function systemFlowHref(
  options: { readonly workspace: string; readonly domain: string; readonly system: string },
  flow: string,
): string {
  return `${systemHref(options)}flows/${flowSlug(flow)}/`;
}

export function domainFlowHref(workspace: string, domain: string, flow: string): string {
  return `${domainHref(workspace, domain)}flows/${flowSlug(flow)}/`;
}

export function teamOf(workspace: Workspace, id: string | null): Team | null {
  return workspace.teams.find((team) => team.id === id) ?? null;
}

/** Every domain, for the static routes. */
export function domainPaths(
  workspaces: readonly Workspace[],
): { readonly workspace: string; readonly domain: string }[] {
  return workspaces.flatMap((workspace) =>
    workspace.domains.map((domain) => ({ workspace: workspace.id, domain: domain.id })),
  );
}

/** Every system, for the static routes. */
export function systemPaths(
  workspaces: readonly Workspace[],
): { readonly workspace: string; readonly domain: string; readonly system: string }[] {
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
