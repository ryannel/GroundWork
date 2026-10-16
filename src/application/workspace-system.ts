import { systemScopeOf } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { catalogueOf, type CatalogueRow } from '@/application/today-catalogue';
import { type ComponentCard, componentCardsOf } from '@/application/today-components';
import { type Neighbours, neighboursOf } from '@/application/today-neighbours';
import { type RepoRow, reposOf } from '@/application/today-repos';
import { type JourneyCard, journeyCardsOf } from '@/application/today-scope';
import type { SystemModel } from '@/application/workspace-model';
import type { Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

import { systemDoes } from './workspace-landscape';
import { domainHref, teamOf, workspaceHref } from './workspace-paths';

// A system page teaches how one system works: what it does and who runs it, how fresh our reading of its code is,
// the map of its components with what is one step outside, the flows through it step by step, and each component
// with what it offers, calls, announces, hears and keeps.

// "Turns a cart into an order" reads as a sentence after the name; anything else keeps the colon.
const claimOf = (name: string, does: string): string =>
  /^[A-Z][a-z]+s\b/u.test(does)
    ? `${name} ${does.charAt(0).toLowerCase()}${does.slice(1)}.`
    : `${name}: ${does}.`;

export interface SystemView {
  readonly trail: readonly { readonly label: string; readonly href: string }[];
  readonly name: string;
  readonly headline: string;
  /** "Run by the Checkout team, in the Website domain" */
  readonly about: string;
  readonly facts: readonly string[];
  readonly repos: readonly RepoRow[];
  readonly journeys: readonly JourneyCard[];
  /** The flows with a step here, most steps here first. */
  readonly flows: readonly string[];
  readonly components: readonly ComponentCard[];
  /** Each store it keeps, with the records in it. */
  readonly data: readonly CatalogueRow[];
  readonly neighbours: Neighbours;
}

const runBy = (team: string): string => `Run by the ${team} team`;

function flowsThrough(model: Model, focus: ReadonlySet<string>): string[] {
  return model.asIs.flows
    .map((f) => ({
      id: f.id,
      here: f.steps.filter((s) => focus.has(s.from) || focus.has(s.to)).length,
    }))
    .filter((f) => f.here > 0)
    .toSorted((a, b) => b.here - a.here)
    .map((f) => f.id);
}

/** A system's page, read from the model of today; null when the domain holds no such system. */
export function systemViewOf(
  workspace: Workspace,
  today: SystemModel,
  path: { readonly domain: string; readonly system: string },
): SystemView | null {
  const domain = workspace.domains.find((each) => each.id === path.domain);
  const system = domain?.systems.find((each) => each.id === path.system);
  const scope = systemScopeOf(workspace, path.system);
  if (domain === undefined || system === undefined || scope === null) return null;
  const { model } = today;
  const does = systemDoes(system).replace(/\.$/, '');
  const team = teamOf(workspace, system.team);
  const flows = flowsThrough(model, scope.focus);
  return {
    trail: [
      { label: workspace.name, href: workspaceHref(workspace.id) },
      { label: domain.name, href: domainHref(workspace.id, domain.id) },
    ],
    name: system.name,
    headline:
      does === '' ? `${system.name} is a system in ${domain.name}.` : claimOf(system.name, does),
    about: `${team === null ? 'No team runs it yet' : runBy(team.name)}, in the ${domain.name} domain`,
    facts: [
      plural(system.components.length, 'component'),
      plural(system.repos.length, 'repo'),
      plural(flows.length, 'flow'),
    ],
    repos: reposOf(workspace, today, system.id),
    journeys: journeyCardsOf(model, workspace.id, scope),
    flows,
    components: componentCardsOf(model, scope),
    data: catalogueOf(model, scope).data,
    neighbours: neighboursOf(workspace, new Set([system.id])),
  };
}
