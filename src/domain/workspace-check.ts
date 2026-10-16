import { componentsOf, systemsOf, type Workspace } from './workspace';

export interface WorkspaceProblems {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// The YAML schema checks each file on its own; these are the rules that span files.
export function checkWorkspace(workspace: Workspace): WorkspaceProblems {
  const errors = [
    ...reservedDomains(workspace),
    ...repeated(
      workspace.domains.map((domain) => domain.id),
      (id) => `domain ${id}: the id is used twice`,
    ),
    ...repeated(
      systemsOf(workspace).map((system) => system.id),
      (id) => `system ${id}: the id is used twice`,
    ),
    ...repeated(
      componentsOf(workspace).map((component) => component.id),
      (id) => `component ${id}: the id is used twice`,
    ),
    ...repeated(
      systemsOf(workspace).flatMap((system) => system.repos),
      (repo) => `repo ${repo}: listed by two systems; a repo belongs to one system`,
    ),
    ...teamProblems(workspace),
    ...connectionProblems(workspace),
  ];
  const warnings = [
    ...workspace.domains
      .filter((domain) => domain.systems.length === 0)
      .map((domain) => `domain ${domain.id}: has no systems yet`),
    ...systemsOf(workspace)
      .filter((system) => system.components.length === 0)
      .map((system) => `system ${system.id}: has no components yet`),
  ];
  return { errors, warnings };
}

/** Page names beside the domains at /<workspace>/<name>/, so no domain may take one. */
export const RESERVED_PAGES: readonly string[] = [
  'plans',
  'journeys',
  'reference',
  'things',
  'assets',
];

function reservedDomains(workspace: Workspace): readonly string[] {
  return workspace.domains
    .filter((domain) => RESERVED_PAGES.includes(domain.id))
    .map((domain) => `domain ${domain.id}: the id is reserved for the ${domain.id} pages`);
}

function repeated(values: readonly string[], problem: (value: string) => string): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) twice.add(value);
    seen.add(value);
  }
  return [...twice].map(problem);
}

function teamProblems(workspace: Workspace): readonly string[] {
  const teams = new Set(workspace.teams.map((team) => team.id));
  return systemsOf(workspace).flatMap((system) => {
    if (system.team === null) return [`system ${system.id}: no team owns it`];
    if (!teams.has(system.team)) {
      return [`system ${system.id}: team ${system.team} is not in workspace.yaml`];
    }
    return [];
  });
}

function connectionProblems(workspace: Workspace): readonly string[] {
  const components = new Set(componentsOf(workspace).map((component) => component.id));
  return componentsOf(workspace).flatMap((component) =>
    component.talksTo
      .filter((connection) => !components.has(connection.to))
      .map(
        (connection) =>
          `component ${component.id}: talks to ${connection.to}, which no system holds`,
      ),
  );
}
