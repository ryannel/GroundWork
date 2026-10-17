import { domainScopeOf } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { teamIndex } from '@/application/plan-viz-teams';
import { type Catalogue, catalogueOf } from '@/application/today-catalogue';
import { type FlowEntry, flowEntriesOf } from '@/application/today-flow-list';
import { type Neighbours, neighboursOf } from '@/application/today-neighbours';
import { journeysHref } from '@/application/today-reader';
import { type JourneyCard, journeyCardsOf } from '@/application/today-scope';
import { type Domain, type Workspace, systemDoes } from '@/domain/workspace';
import { plural } from '@/shared/text';

import { roleOf } from './workspace-landscape';
import { domainFlowHref, domainHref, systemHref, teamOf, workspaceHref } from './workspace-paths';

// A domain page teaches how its systems work together: what the domain is for, the map of its components with the
// systems one step outside, the journeys that run through it, each system, and what it offers, announces and keeps.

export interface DomainTeam {
  readonly name: string;
  /** The team's colour. */
  readonly slot: number;
}

export interface DomainSystemCard {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly does: string;
  readonly team: DomainTeam | null;
  readonly components: number;
  readonly repos: readonly string[];
}

/** How much the domain holds, for the numbers under its name. */
export interface DomainCounts {
  readonly systems: number;
  readonly components: number;
  readonly flows: number;
  /** The endpoints and operations it answers. */
  readonly calls: number;
  readonly events: number;
  readonly stores: number;
}

export interface DomainView {
  readonly workspace: { readonly name: string; readonly href: string };
  readonly name: string;
  readonly href: string;
  readonly headline: string;
  /** What the domain is for, in its own words. */
  readonly purpose: string | null;
  readonly counts: DomainCounts;
  /** The teams that run its systems. */
  readonly teams: readonly DomainTeam[];
  readonly journeys: readonly JourneyCard[];
  /** Where every journey and flow is listed. */
  readonly allJourneys: string;
  /** The flows with a step here, grouped by the system they come in through. */
  readonly flows: readonly FlowEntry[];
  readonly systems: readonly DomainSystemCard[];
  readonly neighbours: Neighbours;
  readonly catalogue: Catalogue;
}

const lowerIn = (role: string): string => role.replace(/^In /u, 'in ');

function headlineOf(
  name: string,
  view: { readonly systems: number; readonly role: string | null; readonly outside: number },
) {
  const systems = plural(view.systems, 'system');
  const role =
    view.role === null ? 'take part in no journey yet' : `take part ${lowerIn(view.role)}`;
  const outside =
    view.outside === 0 ? '' : `, and work with ${plural(view.outside, 'system')} in other domains`;
  return `${name}’s ${systems} ${role}${outside}.`;
}

function teamCard(workspace: Workspace, model: Model, id: string | null): DomainTeam | null {
  const team = teamOf(workspace, id);
  return team === null ? null : { name: team.name, slot: teamIndex(model, team.id) };
}

function countsOf(domain: Domain, flows: number, catalogue: Catalogue): DomainCounts {
  return {
    systems: domain.systems.length,
    components: domain.systems.flatMap((s) => s.components).length,
    flows,
    calls: catalogue.apis.reduce((sum, row) => sum + row.items.length, 0),
    events: catalogue.events.length,
    stores: catalogue.data.length,
  };
}

/** A domain's page, read from the model of today; null when the workspace has no such domain. */
export function domainViewOf(workspace: Workspace, model: Model, id: string): DomainView | null {
  const domain = workspace.domains.find((each) => each.id === id);
  const scope = domainScopeOf(workspace, id);
  if (domain === undefined || scope === null) return null;
  const journeys = journeyCardsOf(model, workspace.id, scope);
  const homes = new Map(
    domain.systems.flatMap((system) => [
      [`sys:${system.id}`, system.name] as const,
      ...system.components.map((c) => [c.id, system.name] as const),
    ]),
  );
  const neighbours = neighboursOf(workspace, new Set(domain.systems.map((s) => s.id)));
  const outside = new Set([...neighbours.reaches, ...neighbours.reachedBy].map((n) => n.id)).size;
  const teams = [...new Set(domain.systems.map((s) => s.team))].flatMap(
    (team) => teamCard(workspace, model, team) ?? [],
  );
  const flows = flowEntriesOf(model, {
    focus: scope.focus,
    hrefOf: (flow) => domainFlowHref(workspace.id, domain.id, flow),
    groupOf: (part) => homes.get(part) ?? model.label(part),
  });
  const catalogue = catalogueOf(model, scope);
  return {
    workspace: { name: workspace.name, href: workspaceHref(workspace.id) },
    name: domain.name,
    href: domainHref(workspace.id, domain.id),
    headline: headlineOf(domain.name, {
      systems: domain.systems.length,
      role: roleOf(domain, journeys),
      outside,
    }),
    purpose: domain.purpose,
    counts: countsOf(domain, flows.length, catalogue),
    teams,
    journeys,
    allJourneys: journeysHref(workspace.id),
    flows,
    systems: domain.systems.map((system) => ({
      id: system.id,
      name: system.name,
      href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      does: systemDoes(system),
      team: teamCard(workspace, model, system.team),
      components: system.components.length,
      repos: system.repos,
    })),
    neighbours,
    catalogue,
  };
}
