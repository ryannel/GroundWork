import { systemsOf, type Workspace } from '@/domain/workspace';
import { systemLinks } from '@/domain/workspace-links';
import { plural } from '@/shared/text';

import { layoutDiagram, type Diagram } from './workspace-diagram';
import { domainHref, systemHref, teamOf } from './workspace-paths';

export interface DomainSummary {
  readonly id: string;
  readonly name: string;
  readonly purpose: string | null;
  readonly href: string;
  readonly size: string;
}

export interface Landscape {
  readonly name: string;
  /** What the workspace is for, in its own words. */
  readonly description: string | null;
  /** Short facts for the line under the description. */
  readonly facts: readonly string[];
  readonly domains: readonly DomainSummary[];
  readonly diagram: Diagram;
}

export function landscapeOf(workspace: Workspace): Landscape {
  const links = systemLinks(workspace.domains);
  const domainOf = new Map(
    workspace.domains.flatMap((domain) => domain.systems.map((system) => [system.id, domain.id])),
  );
  const across = links.filter((link) => domainOf.get(link.from) !== domainOf.get(link.to));
  return {
    name: workspace.name,
    description: workspace.description,
    facts: [
      plural(workspace.domains.length, 'domain'),
      plural(systemsOf(workspace).length, 'system'),
      `${plural(links.length, 'connection')}, ${String(across.length)} across domains`,
    ],
    domains: workspace.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      purpose: domain.purpose,
      href: domainHref(workspace.id, domain.id),
      size: plural(domain.systems.length, 'system'),
    })),
    diagram: layoutDiagram(
      workspace.domains.map((domain) => ({
        id: domain.id,
        label: domain.name,
        href: domainHref(workspace.id, domain.id),
        quiet: false,
        nodes: domain.systems.map((system) => {
          const team = teamOf(workspace, system.team);
          return {
            id: system.id,
            label: system.name,
            detail: team?.name ?? null,
            href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
            team: team?.colour ?? null,
            quiet: false,
          };
        }),
      })),
      links,
    ),
  };
}
