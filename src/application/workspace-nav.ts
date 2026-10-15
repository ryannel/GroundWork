import type { Workspace } from '@/domain/workspace';

import { domainHref, systemHref, workspaceHref } from './workspace-paths';

export interface NavItem {
  readonly href: string;
  readonly title: string;
  readonly current: boolean;
}

export interface NavGroup {
  readonly key: string;
  readonly marker: string;
  readonly title: string;
  readonly href: string;
  readonly count?: string;
  readonly current: boolean;
  readonly open: boolean;
  readonly side?: boolean;
  readonly items: readonly NavItem[];
}

/** Where the reader is in the workspace: its landscape, a domain, or a system in one. */
export interface NavHere {
  readonly domain?: string;
  readonly system?: string;
}

interface PlanLink {
  readonly id: string;
  readonly title: string;
  readonly href: string;
}

// The workspace as a rail: its landscape first, then each domain opening to its systems, then its plans apart.
export function workspaceNavOf(
  workspace: Workspace,
  plans: readonly PlanLink[],
  here: NavHere,
): NavGroup[] {
  const landscape: NavGroup = {
    key: 'landscape',
    marker: '◦',
    title: 'Landscape',
    href: workspaceHref(workspace.id),
    current: here.domain === undefined,
    open: false,
    items: [],
  };
  const domains = workspace.domains.map((domain, index): NavGroup => {
    const current = domain.id === here.domain;
    return {
      key: `domain:${domain.id}`,
      marker: String(index + 1),
      title: domain.name,
      href: domainHref(workspace.id, domain.id),
      count: String(domain.systems.length),
      current,
      open: current,
      items: domain.systems.map((system) => ({
        href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
        title: system.name,
        current: current && system.id === here.system,
      })),
    };
  });
  if (plans.length === 0) return [landscape, ...domains];
  const planGroup: NavGroup = {
    key: 'plans',
    marker: 'P',
    title: 'Plans',
    href: `${workspaceHref(workspace.id)}#plans`,
    count: String(plans.length),
    current: false,
    open: true,
    side: true,
    items: plans.map((plan) => ({ href: plan.href, title: plan.title, current: false })),
  };
  return [landscape, ...domains, planGroup];
}
