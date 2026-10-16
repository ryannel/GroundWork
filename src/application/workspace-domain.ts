import { domainScopeOf } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { andList } from '@/application/plan-viz-ladder-order';
import { type Catalogue, catalogueOf } from '@/application/today-catalogue';
import { type Neighbours, neighboursOf } from '@/application/today-neighbours';
import { type JourneyCard, journeyCardsOf } from '@/application/today-scope';
import { type Workspace, systemDoes } from '@/domain/workspace';
import { plural } from '@/shared/text';

import { roleOf } from './workspace-landscape';
import { systemHref, teamOf, workspaceHref } from './workspace-paths';

// A domain page teaches how its systems work together: what the domain is for, the map of its components with the
// systems one step outside, the journeys that run through it, each system, and what it offers, announces and keeps.

export interface DomainSystemCard {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly does: string;
  /** "Checkout team · 4 components · alder-finch/checkout" */
  readonly about: readonly string[];
}

export interface DomainView {
  readonly workspace: { readonly name: string; readonly href: string };
  readonly name: string;
  readonly headline: string;
  /** What the domain is for, in its own words. */
  readonly purpose: string | null;
  readonly facts: readonly string[];
  readonly journeys: readonly JourneyCard[];
  readonly systems: readonly DomainSystemCard[];
  readonly neighbours: Neighbours;
  readonly catalogue: Catalogue;
}

function headlineOf(name: string, view: { systems: number; role: string | null; outside: number }) {
  const systems = plural(view.systems, 'system');
  const role =
    view.role === null ? 'take part in no journey yet' : `take part ${lowerIn(view.role)}`;
  const outside =
    view.outside === 0 ? '' : `, and work with ${plural(view.outside, 'system')} in other domains`;
  return `${name}’s ${systems} ${role}${outside}.`;
}

function runBy(teams: readonly string[]): string {
  if (teams.length === 0) return 'No team named';
  return `Run by the ${andList(teams)} ${teams.length === 1 ? 'team' : 'teams'}`;
}

const lowerIn = (role: string): string => role.replace(/^In /, 'in ');

/** A domain's page, read from the model of today; null when the workspace has no such domain. */
export function domainViewOf(workspace: Workspace, model: Model, id: string): DomainView | null {
  const domain = workspace.domains.find((each) => each.id === id);
  const scope = domainScopeOf(workspace, id);
  if (domain === undefined || scope === null) return null;
  const journeys = journeyCardsOf(model, workspace.id, scope);
  const neighbours = neighboursOf(workspace, new Set(domain.systems.map((s) => s.id)));
  const outside = new Set([...neighbours.reaches, ...neighbours.reachedBy].map((n) => n.id)).size;
  const teams = [...new Set(domain.systems.map((s) => teamOf(workspace, s.team)?.name ?? null))];
  const named = teams.filter((t): t is string => t !== null);
  return {
    workspace: { name: workspace.name, href: workspaceHref(workspace.id) },
    name: domain.name,
    headline: headlineOf(domain.name, {
      systems: domain.systems.length,
      role: roleOf(domain, journeys),
      outside,
    }),
    purpose: domain.purpose,
    facts: [
      plural(domain.systems.length, 'system'),
      plural(domain.systems.flatMap((s) => s.components).length, 'component'),
      runBy(named),
    ],
    journeys,
    systems: domain.systems.map((system) => ({
      id: system.id,
      name: system.name,
      href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      does: systemDoes(system),
      about: [
        teamOf(workspace, system.team)?.name ?? 'No team',
        plural(system.components.length, 'component'),
        ...system.repos,
      ],
    })),
    neighbours,
    catalogue: catalogueOf(model, scope),
  };
}
