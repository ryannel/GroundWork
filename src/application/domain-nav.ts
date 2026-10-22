import type { Workspace } from '@/domain/workspace';
import type { TargetArchitecture } from '@/domain/workspace-model';

import type { DomainView } from './workspace-domain';
import type { NavGroup, NavItem } from './workspace-nav';

/** The rail inside a domain: a way back to the workspace, the domain's name, and its own pages. */
export interface DomainNav {
  readonly top: {
    readonly back: { readonly label: string; readonly href: string };
    readonly title: string;
  };
  readonly groups: readonly NavGroup[];
}

/** The parts of a system's page, in the order the page draws them. */
export interface SystemSections {
  readonly id: string;
  readonly flows: boolean;
  readonly data: boolean;
}

/** The anchor for a section of a page, from its title. */
export const sectionId = (title: string): string => title.toLowerCase().replaceAll(' ', '-');

/** The sections a system page draws: flows and data only when it has some. */
export function systemSectionsOf(sections: SystemSections): string[] {
  return [
    'Plans',
    'Map',
    'Edges',
    ...(sections.flows ? ['Flows'] : []),
    'Components',
    ...(sections.data ? ['Data'] : []),
    'User journeys',
    'Code',
  ];
}

const counted = (count: number) => (count === 0 ? {} : { count: String(count) });

// The ways to read a domain, as its tabs were: the overview, where it is heading and its plans, then flows, map,
// language and interfaces when it has any to show.
function pagesOf(view: DomainView, here: Here, current: boolean): NavItem[] {
  const { words, plans = 0, stages = 0 } = here;
  const { href, counts } = view;
  const kept = counts.calls + counts.events + counts.stores;
  const page = (path: string, title: string, count: number): NavItem => ({
    href: `${href}${path}`,
    title,
    current: current && path === '',
    ...counted(count),
  });
  return [
    page('', 'Overview', 0),
    page('target/', 'Target architecture', stages),
    page('plans/', 'Plans', plans),
    ...(counts.flows === 0 ? [] : [page('flows/', 'Flows', counts.flows)]),
    page('map/', 'Map', counts.components),
    ...(words === 0 ? [] : [page('language/', 'Language', words)]),
    ...(kept === 0 ? [] : [page('interfaces/', 'Interfaces', kept)]),
  ];
}

// Inside a domain, the rail lists the domain's own pages and its systems; the system being read opens to the
// sections of its page.
interface Here {
  readonly words: number;
  /** How many plans reach the domain. */
  readonly plans?: number;
  /** How many stages its target architecture has. */
  readonly stages?: number;
  readonly system?: SystemSections;
}

export function domainNavOf(workspace: Workspace, view: DomainView, here: Here): DomainNav {
  const reading = here.system;
  const systems = view.systems.map((system): NavItem => {
    const current = system.id === reading?.id;
    return {
      href: system.href,
      title: system.name,
      current,
      ...(current
        ? {
            items: systemSectionsOf(reading).map((title) => ({
              href: `${system.href}#${sectionId(title)}`,
              title,
              current: false,
            })),
          }
        : {}),
    };
  });
  return {
    top: { back: { label: workspace.name, href: view.workspace.href }, title: view.name },
    groups: [
      {
        key: 'domain',
        title: view.name,
        href: view.href,
        current: reading === undefined,
        open: true,
        bare: true,
        byPath: reading === undefined,
        items: pagesOf(view, here, reading === undefined),
      },
      {
        key: 'systems',
        heading: 'Systems',
        title: 'Systems',
        href: `${view.href}#systems`,
        current: reading !== undefined,
        open: true,
        bare: true,
        items: systems,
      },
    ],
  };
}

/** How many stages a domain's target architecture has, for the rail's count. */
export function targetStagesOf(targets: readonly TargetArchitecture[], domain: string): number {
  return targets.find((each) => each.domain === domain)?.stages.length ?? 0;
}
