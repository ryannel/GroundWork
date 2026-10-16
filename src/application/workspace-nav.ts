import type { Model } from '@/application/plan/derive';
import type { Workspace } from '@/domain/workspace';

import { todayJourneysOf } from './today-journeys';
import { journeyHref, journeysHref, referenceHref, referenceKindHref } from './today-reader';
import { referenceOf } from './today-reference';
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

/** Where the reader is in the workspace: its landscape, a domain, or a system in one, or its journeys or
 * reference, at one of them by key. */
export interface NavHere {
  readonly domain?: string;
  readonly system?: string;
  readonly section?: 'journeys' | 'reference';
  /** The journey's key or the reference's kind being read. */
  readonly key?: string;
  /** The workspace as it runs today; with it the journeys and reference list what they hold. */
  readonly today?: Model;
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
    current: here.domain === undefined && here.section === undefined,
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
  const today = [journeysGroup(workspace.id, here), referenceGroup(workspace.id, here)];
  if (plans.length === 0) return [landscape, ...domains, ...today];
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
  return [landscape, ...domains, ...today, planGroup];
}

function journeysGroup(workspace: string, here: NavHere): NavGroup {
  const current = here.section === 'journeys';
  const journeys = here.today === undefined ? [] : todayJourneysOf(here.today);
  return {
    key: 'journeys',
    marker: 'J',
    title: 'Journeys',
    href: journeysHref(workspace),
    ...(journeys.length === 0 ? {} : { count: String(journeys.length) }),
    current,
    open: current,
    items: journeys.map((journey) => ({
      href: journeyHref(workspace, journey.key),
      title: journey.title,
      current: current && journey.key === here.key,
    })),
  };
}

function referenceGroup(workspace: string, here: NavHere): NavGroup {
  const current = here.section === 'reference';
  const kinds = here.today === undefined ? [] : referenceOf(here.today);
  return {
    key: 'reference',
    marker: 'R',
    title: 'Reference',
    href: referenceHref(workspace),
    current,
    open: current,
    items: kinds.map((entry) => ({
      href: referenceKindHref(workspace, entry.kind),
      title: entry.title,
      current: current && entry.kind === here.key,
    })),
  };
}
