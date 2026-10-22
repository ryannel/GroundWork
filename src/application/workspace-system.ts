import { systemScopeOf } from '@/application/model-scope';
import { catalogueOf, type CatalogueRow } from '@/application/today-catalogue';
import { type ComponentCard, componentCardsOf } from '@/application/today-components';
import { type FlowEntry, flowEntriesOf } from '@/application/today-flow-list';
import { type Neighbours, neighboursOf } from '@/application/today-neighbours';
import { journeysHref } from '@/application/today-reader';
import { type RepoRow, reposOf } from '@/application/today-repos';
import { type JourneyCard, journeyCardsOf } from '@/application/today-scope';
import type { SystemModel } from '@/application/workspace-model';
import { type Workspace, systemDoes } from '@/domain/workspace';
import { plural } from '@/shared/text';

import { domainHref, systemFlowHref, teamOf, workspaceHref } from './workspace-paths';

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
  /** "Run by the Checkout team"; the trail already says which domain. */
  readonly about: string;
  readonly facts: readonly string[];
  readonly repos: readonly RepoRow[];
  readonly journeys: readonly JourneyCard[];
  /** The flows with a step here, most steps here first. */
  readonly flows: readonly FlowEntry[];
  /** Where every journey and flow is listed. */
  readonly allJourneys: string;
  readonly components: readonly ComponentCard[];
  /** Each store it keeps, with the records in it. */
  readonly data: readonly CatalogueRow[];
  readonly neighbours: Neighbours;
}

const runBy = (team: string): string => `Run by the ${team} team`;

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
  const does = systemDoes(system).replace(/\.$/u, '');
  const team = teamOf(workspace, system.team);
  const flows = flowEntriesOf(model, {
    focus: scope.focus,
    hrefOf: (flow) =>
      systemFlowHref({ workspace: workspace.id, domain: domain.id, system: system.id }, flow),
  });
  return {
    trail: [
      { label: workspace.name, href: workspaceHref(workspace.id) },
      { label: domain.name, href: domainHref(workspace.id, domain.id) },
    ],
    name: system.name,
    headline:
      does === '' ? `${system.name} is a system in ${domain.name}.` : claimOf(system.name, does),
    about: team === null ? 'No team runs it yet' : runBy(team.name),
    facts: [
      plural(system.components.length, 'component'),
      plural(system.repos.length, 'repo'),
      plural(flows.length, 'flow'),
    ],
    repos: reposOf(workspace, today, system.id),
    journeys: journeyCardsOf(model, workspace.id, scope),
    flows,
    allJourneys: journeysHref(workspace.id),
    components: componentCardsOf(model, scope),
    data: catalogueOf(model, scope).data,
    neighbours: neighboursOf(workspace, new Set([system.id])),
  };
}
