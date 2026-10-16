import { workspaceScopeOf } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { andList } from '@/application/plan-viz-ladder-order';
import { type JourneyCard, journeyCardsOf } from '@/application/today-scope';
import {
  componentsOf,
  type Domain,
  type System,
  systemsOf,
  type Workspace,
} from '@/domain/workspace';
import { plural } from '@/shared/text';

import { domainHref, systemHref } from './workspace-paths';

// The landscape teaches the whole workspace: what is true of it in one line, how the company works, the map, the
// journeys that carry the work, and each domain with its systems and its part in those journeys.

export interface SystemLine {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  /** What its lead component does, or empty. */
  readonly does: string;
}

export interface DomainCard {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly purpose: string | null;
  /** "4 systems · 18 components" */
  readonly size: string;
  readonly systems: readonly SystemLine[];
  /** Its part in the journeys: "In 2 user journeys and 9 flows", or null when none crosses it. */
  readonly role: string | null;
}

export interface Landscape {
  readonly name: string;
  /** What is true of the workspace, as one sentence. */
  readonly headline: string;
  /** How the company works, as markdown, when the workspace tells it. */
  readonly summary: string | null;
  readonly facts: readonly string[];
  readonly journeys: readonly JourneyCard[];
  readonly domains: readonly DomainCard[];
}

const lowerFirst = (words: string): string => `${words.charAt(0).toLowerCase()}${words.slice(1)}`;

function headlineOf(workspace: Workspace): string {
  const systems = plural(systemsOf(workspace).length, 'system');
  const runs = `${workspace.name} runs ${systems} in ${plural(workspace.domains.length, 'domain')}`;
  const what = workspace.description?.trim().replace(/\.$/, '') ?? '';
  return what === '' ? `${runs}.` : `${runs}: ${lowerFirst(what)}.`;
}

/** What a system is for, in the words of its namesake component, or of its first own component that says. */
export function systemDoes(system: System): string {
  const says = system.components.filter((c) => c.type !== 'external' && c.does !== null);
  const lead = says.find((c) => c.name === system.name) ?? says.find((c) => c.type === 'service');
  return (lead ?? says[0])?.does ?? '';
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

function domainCardOf(workspace: Workspace, domain: Domain, journeys: readonly JourneyCard[]) {
  const components = domain.systems.flatMap((s) => s.components).length;
  return {
    id: domain.id,
    name: domain.name,
    href: domainHref(workspace.id, domain.id),
    purpose: domain.purpose,
    size: `${plural(domain.systems.length, 'system')} · ${plural(components, 'component')}`,
    systems: domain.systems.map((system) => ({
      id: system.id,
      name: system.name,
      href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      does: systemDoes(system),
    })),
    role: roleOf(domain, journeys),
  };
}

/** The landscape of a workspace, read from its model of today. */
export function landscapeOf(workspace: Workspace, model: Model): Landscape {
  const journeys = journeyCardsOf(model, workspace.id, workspaceScopeOf(workspace));
  return {
    name: workspace.name,
    headline: headlineOf(workspace),
    summary: model.plan.domain?.summary ?? null,
    facts: [
      plural(workspace.domains.length, 'domain'),
      plural(systemsOf(workspace).length, 'system'),
      plural(componentsOf(workspace).length, 'component'),
      plural(model.asIs.userJourneys.length, 'user journey'),
      plural(model.asIs.flows.length, 'flow'),
    ],
    journeys,
    domains: workspace.domains.map((domain) => domainCardOf(workspace, domain, journeys)),
  };
}
