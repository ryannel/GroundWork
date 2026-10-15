import type { Domain, System, Workspace } from '@/domain/workspace';
import { systemLinks, type Link } from '@/domain/workspace-links';
import { plural } from '@/shared/text';

import { layoutDiagram, type Diagram, type DiagramNodeInput } from './workspace-diagram';
import { systemHref, teamOf, workspaceHref } from './workspace-paths';

export interface DomainSystemRow {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly team: string;
  readonly components: number;
}

export interface DomainView {
  readonly workspace: { readonly name: string; readonly href: string };
  readonly name: string;
  /** What the domain is for, in its own words. */
  readonly description: string | null;
  /** Short facts for the line under the description. */
  readonly facts: readonly string[];
  readonly systems: readonly DomainSystemRow[];
  readonly diagram: Diagram;
}

interface Located {
  readonly domain: Domain;
  readonly system: System;
}

export function domainViewOf(workspace: Workspace, domainId: string): DomainView | null {
  const domain = workspace.domains.find((candidate) => candidate.id === domainId);
  if (domain === undefined) return null;
  const located = new Map<string, Located>(
    workspace.domains.flatMap((home) =>
      home.systems.map((system) => [system.id, { domain: home, system }]),
    ),
  );
  const inside = new Set(domain.systems.map((system) => system.id));
  const links = systemLinks(workspace.domains).filter(
    (link) => inside.has(link.from) || inside.has(link.to),
  );
  const outside = outsideOf(links, inside);
  const node = (id: string): DiagramNodeInput[] => {
    const found = located.get(id);
    return found === undefined ? [] : [nodeOf(workspace, found, !inside.has(id))];
  };
  const teams = new Set(domain.systems.map((system) => system.team));
  return {
    workspace: { name: workspace.name, href: workspaceHref(workspace.id) },
    name: domain.name,
    description: domain.purpose,
    facts: [
      plural(domain.systems.length, 'system'),
      plural(teams.size, 'team'),
      `${plural(outside.callers.length + outside.callees.length, 'connected system')} in other domains`,
    ],
    systems: domain.systems.map((system) => ({
      id: system.id,
      name: system.name,
      href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      team: teamOf(workspace, system.team)?.name ?? 'No team',
      components: system.components.length,
    })),
    diagram: layoutDiagram(
      [
        column({
          id: 'callers',
          label: 'Calls in from other domains',
          nodes: outside.callers.flatMap(node),
        }),
        {
          id: domain.id,
          label: domain.name,
          href: null,
          quiet: false,
          nodes: domain.systems.flatMap((system) => node(system.id)),
        },
        column({
          id: 'callees',
          label: 'Other domains it talks to',
          nodes: outside.callees.flatMap(node),
        }),
      ].filter((entry) => entry.nodes.length > 0 || entry.id === domain.id),
      links,
    ),
  };
}

// A system outside the domain sits on the right if the domain talks to it, otherwise on the left.
function outsideOf(links: readonly Link[], inside: ReadonlySet<string>) {
  const callees = [
    ...new Set(links.filter((link) => inside.has(link.from)).map((link) => link.to)),
  ].filter((id) => !inside.has(id));
  const callers = [
    ...new Set(links.filter((link) => inside.has(link.to)).map((link) => link.from)),
  ].filter((id) => !inside.has(id) && !callees.includes(id));
  return { callers, callees };
}

function column(options: { id: string; label: string; nodes: readonly DiagramNodeInput[] }) {
  return { ...options, href: null, quiet: true };
}

function nodeOf(workspace: Workspace, found: Located, quiet: boolean): DiagramNodeInput {
  const team = teamOf(workspace, found.system.team);
  return {
    id: found.system.id,
    label: found.system.name,
    detail: quiet ? found.domain.name : (team?.name ?? null),
    href: systemHref({ workspace: workspace.id, domain: found.domain.id, system: found.system.id }),
    team: team?.colour ?? null,
    quiet,
  };
}
