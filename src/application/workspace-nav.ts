import type { Model } from '@/application/plan/derive';
import type { Workspace } from '@/domain/workspace';

import { keyJourneysOf } from './key-journeys';
import { todayJourneysOf } from './today-journeys';
import { journeyHref, journeysHref, referenceHref, referenceKindHref } from './today-reader';
import { referenceOf } from './today-reference';
import { domainHref, languageHref, peopleHref, plansHref, workspaceHref } from './workspace-paths';

export interface NavItem {
  readonly href: string;
  readonly title: string;
  readonly current: boolean;
  readonly count?: string;
  /** Its own parts, listed under it. */
  readonly items?: readonly NavItem[];
}

export interface NavGroup {
  readonly key: string;
  readonly marker?: string;
  readonly title: string;
  readonly href: string;
  readonly count?: string;
  readonly current: boolean;
  readonly open: boolean;
  /** Starts a section of the rail, under this heading. */
  readonly heading?: string;
  /** Lists its items without a head of its own. */
  readonly bare?: boolean;
  /** Which item is open is read from the address, as the rail is drawn once for every page under it. */
  readonly byPath?: boolean;
  readonly items: readonly NavItem[];
}

/** Where the reader is in the workspace: its map, language or people, a domain, or a system in one, its
 * journeys or reference (at one of them by key), or its plans. */
export interface NavHere {
  readonly domain?: string;
  readonly system?: string;
  readonly section?: 'journeys' | 'reference' | 'language' | 'people' | 'plans';
  /** The journey's key or the reference's kind being read. */
  readonly key?: string;
  /** The workspace as it runs today; with it the journeys and reference list what they hold. */
  readonly today?: Model;
}

// The landscape's own pages: the map of the whole workspace, its words, and the people who use it.
function landscapeGroup(workspace: string, here: NavHere): NavGroup {
  const map = here.domain === undefined && here.section === undefined;
  const words = here.section === 'language';
  const people = here.section === 'people';
  return {
    key: 'landscape',
    heading: 'Overview',
    title: 'Landscape',
    href: workspaceHref(workspace),
    current: map,
    open: map || words || people,
    items: [
      { href: workspaceHref(workspace), title: 'Map', current: map },
      { href: languageHref(workspace), title: 'Language', current: words },
      { href: peopleHref(workspace), title: 'People', current: people },
    ],
  };
}

// The workspace as a rail in three sections: an overview (the landscape and the plans), the domains, and what to
// look up (the journeys and the reference). Stepping into a domain swaps this rail for the domain's own.
export function workspaceNavOf(
  workspace: Workspace,
  plans: readonly unknown[],
  here: NavHere,
): NavGroup[] {
  // A workspace can hold hundreds of plans, so the rail counts them and the index finds them.
  const planGroup: NavGroup = {
    key: 'plans',
    title: 'Plans',
    href: plansHref(workspace.id),
    ...(plans.length === 0 ? {} : { count: String(plans.length) }),
    current: here.section === 'plans',
    open: false,
    items: [],
  };
  const domains = workspace.domains.map((domain, index): NavGroup => {
    const current = domain.id === here.domain;
    return {
      key: `domain:${domain.id}`,
      ...(index === 0 ? { heading: 'Domains' } : {}),
      title: domain.name,
      href: domainHref(workspace.id, domain.id),
      count: String(domain.systems.length),
      current,
      open: false,
      items: [],
    };
  });
  return [
    landscapeGroup(workspace.id, here),
    planGroup,
    ...domains,
    journeysGroup(workspace, here),
    referenceGroup(workspace.id, here),
  ];
}

// The journeys group counts them all but names only the key ones, and the one being read: a workspace can run
// thousands, and the index is where they are found.
function journeysGroup(workspace: Workspace, here: NavHere): NavGroup {
  const current = here.section === 'journeys';
  const journeys = here.today === undefined ? [] : todayJourneysOf(here.today);
  const key =
    here.today === undefined
      ? []
      : keyJourneysOf(workspace, here.today).picked.map((k) => k.journey);
  const reading = journeys.find((j) => current && j.key === here.key);
  const named = reading === undefined || key.includes(reading) ? key : [...key, reading];
  return {
    key: 'journeys',
    heading: 'Look up',
    title: 'Journeys',
    href: journeysHref(workspace.id),
    ...(journeys.length === 0 ? {} : { count: String(journeys.length) }),
    current,
    open: current,
    items: named.map((journey) => ({
      href: journeyHref(workspace.id, journey.key),
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
