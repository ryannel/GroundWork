import { domainMapOf, type DomainMap } from '@/application/landscape-domains';
import { drawDomainMap, type MapDrawing } from '@/application/landscape-domains-layout';
import type { Model } from '@/application/plan/derive';
import { andList } from '@/application/plan-viz-ladder-order';
import type { JourneyCard } from '@/application/today-scope';
import { componentsOf, type Domain, systemsOf, type Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

// The landscape teaches the whole workspace: what is true of it in one line, and the map of its domains, the
// people who work in each, the customer they serve, and how the domains rely on one another.

export interface Landscape {
  readonly name: string;
  /** What is true of the workspace, as one sentence. */
  readonly headline: string;
  readonly facts: readonly string[];
  /** The domains, the people in them, the customer, and the lines between. */
  readonly map: DomainMap;
  /** Where the map puts each box and line. */
  readonly drawing: MapDrawing;
}

const lowerFirst = (words: string): string => `${words.charAt(0).toLowerCase()}${words.slice(1)}`;

function headlineOf(workspace: Workspace): string {
  const count = systemsOf(workspace).length;
  const what = workspace.description?.trim().replace(/\.$/u, '') ?? '';
  if (count === 0) {
    return what === ''
      ? `None of ${workspace.name}'s systems is mapped yet.`
      : `${what}. None of its systems is mapped yet.`;
  }
  const runs = `${workspace.name} runs ${plural(count, 'system')} in ${plural(workspace.domains.length, 'domain')}`;
  return what === '' ? `${runs}.` : `${runs}: ${lowerFirst(what)}.`;
}

/** A domain's part in the journeys: "In 2 user journeys and 9 flows". */
export function roleOf(domain: Domain, journeys: readonly JourneyCard[]): string | null {
  const ids = new Set(domain.systems.map((s) => `sys:${s.id}`));
  const here = journeys.filter((j) => j.systems.some((id) => ids.has(id)));
  const users = here.filter((j) => j.kind === 'journey').length;
  const flows = here.length - users;
  const parts = [
    ...(users === 0 ? [] : [plural(users, 'user journey')]),
    ...(flows === 0 ? [] : [plural(flows, 'flow')]),
  ];
  return parts.length === 0 ? null : `In ${andList(parts)}`;
}

/** The landscape of a workspace, read from its model of today. */
export function landscapeOf(workspace: Workspace, model: Model): Landscape {
  const map = domainMapOf(workspace, model);
  return {
    name: workspace.name,
    headline: headlineOf(workspace),
    facts: [
      plural(workspace.domains.length, 'domain'),
      plural(systemsOf(workspace).length, 'system'),
      plural(map.people.length, 'person', 'people'),
      plural(componentsOf(workspace).length, 'component'),
      plural(map.journeys.length, 'journey and flow', 'journeys and flows'),
    ],
    map,
    drawing: drawDomainMap(map),
  };
}
