import { componentsOf, systemsOf, type Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

import type { PlanInput } from './plan-footprint';
import { briefsOf, type PlanBrief } from './workspace-library-plans';
import { domainHref, workspaceHref } from './workspace-paths';

/** How many plans a panel lists before it points to the workspace for the rest. */
const PLANS_SHOWN = 6;

export interface DomainLink {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly systems: string;
}

export interface WorkspaceCard {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly description: string | null;
  readonly isPrivate: boolean;
  /** Its size, as short facts: "3 domains", "14 systems". */
  readonly facts: readonly string[];
  readonly domains: readonly DomainLink[];
  /** The plans someone should look at first; `morePlans` more are on the workspace page. */
  readonly plans: readonly PlanBrief[];
  readonly morePlans: number;
}

export interface Library {
  readonly cards: readonly WorkspaceCard[];
}

// Shared workspaces first, then by name: the one a team works in leads.
export function libraryOf(
  workspaces: readonly Workspace[],
  plans: ReadonlyMap<string, readonly PlanInput[]> = new Map(),
  today = new Date(),
): Library {
  const cards = workspaces.toSorted(sharedFirst).map((workspace) => {
    const briefs = briefsOf(workspace.id, plans.get(workspace.id) ?? [], today);
    return {
      id: workspace.id,
      name: workspace.name,
      href: workspaceHref(workspace.id),
      description: workspace.description,
      isPrivate: workspace.isPrivate,
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
