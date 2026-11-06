import { buildId, stripPrefix } from '@/domain/ids';
import type { Team, Workspace } from '@/domain/workspace';

export function workspaceHref(workspace: string): string {
  return `/${workspace}/`;
}

export const languageHref = (workspace: string): string => `/${workspace}/language/`;

export const valueFlowsHref = (workspace: string): string => `/${workspace}/value-flows/`;

export const peopleHref = (workspace: string): string => `/${workspace}/people/`;

export const plansHref = (workspace: string): string => `/${workspace}/plans/`;

export const programmesHref = (workspace: string): string => `/${workspace}/programmes/`;

export const programmeHref = (workspace: string, programme: string): string =>
  `${programmesHref(workspace)}${programme}/`;

export const partnersHref = (workspace: string): string => `/${workspace}/partners/`;

/** A team's part of a partner's address: its id without `team:`. */
const teamSlug = (id: string): string => stripPrefix(id, 'team');

export const partnerHref = (workspace: string, team: string): string =>
  `${partnersHref(workspace)}${teamSlug(team)}/`;

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
  return stripPrefix(id, 'flow');
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
