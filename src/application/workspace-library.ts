import { componentsOf, systemsOf, type Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

import type { PlanInput } from './plan-footprint';
import { workspaceLocationOf, type Library, type WorkspaceLink } from './workspace-card';
import { briefsOf } from './workspace-library-plans';
import { domainHref, workspaceHref } from './workspace-paths';

export type { Library, WorkspaceCard, WorkspaceLink } from './workspace-card';

/** How many plans a panel lists before it points to the workspace for the rest. */
const PLANS_SHOWN = 6;

// Shared workspaces first, then by name: the one a team works in leads.
export function libraryOf(
  workspaces: readonly Workspace[],
  plans: ReadonlyMap<string, readonly PlanInput[]>,
  today: Date,
  links: readonly WorkspaceLink[] = [],
  localDetails = false,
): Library {
  const cards = workspaces.toSorted(sharedFirst).map((workspace) => {
    const briefs = briefsOf(workspace.id, plans.get(workspace.id) ?? [], today);
    const link = links.find((each) => each.id === workspace.id);
    return {
      id: workspace.id,
      name: workspace.name,
      href: workspaceHref(workspace.id),
      description: workspace.description,
      isPrivate: workspace.isPrivate,
      isExample: link?.isExample ?? false,
      location: workspaceLocationOf(link, localDetails),
      facts: [
        plural(workspace.domains.length, 'domain'),
        plural(systemsOf(workspace).length, 'system'),
        plural(componentsOf(workspace).length, 'component'),
        plural(briefs.length, 'plan'),
      ],
      domains: workspace.domains.map((domain) => ({
        id: domain.id,
        name: domain.name,
        href: domainHref(workspace.id, domain.id),
        systems: plural(domain.systems.length, 'system'),
      })),
      plans: briefs.slice(0, PLANS_SHOWN),
      morePlans: Math.max(0, briefs.length - PLANS_SHOWN),
    };
  });
  return { cards };
}

function sharedFirst(a: Workspace, b: Workspace): number {
  if (a.isPrivate !== b.isPrivate) return a.isPrivate ? 1 : -1;
  return a.name.localeCompare(b.name);
}
