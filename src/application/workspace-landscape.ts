import { type KeyJourneys, keyJourneysOf } from '@/application/key-journeys';
import { landscapeMapInput, type LandscapeMapInput } from '@/application/landscape-map-input';
import { workspaceScopeOf } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { andList } from '@/application/plan-viz-ladder-order';
import { teamIndex } from '@/application/plan-viz-teams';
import { type JourneyCard, journeyCardOf, journeyCardsOf } from '@/application/today-scope';
import { componentsOf, type Domain, systemsOf, type Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

import { journeysHref } from './today-reader';
import { systemHref } from './workspace-paths';

// The landscape teaches the whole workspace: what is true of it in one line, the canvas of who uses which domain
// and how the domains connect, the journeys that carry the work, and the teams that run it.

/** A team and the systems it runs. */
export interface TeamRow {
  readonly id: string;
  readonly name: string;
  readonly slot: number;
  readonly channel: string | null;
  readonly systems: readonly { readonly name: string; readonly href: string }[];
}

export interface Landscape {
  readonly name: string;
  /** What is true of the workspace, as one sentence. */
  readonly headline: string;
  readonly facts: readonly string[];
  /** The people, domains and outside services, and how they connect. */
  readonly map: LandscapeMapInput;
  readonly journeys: readonly JourneyCard[];
  /** The journeys the workspace leads with, and whether a person or the code picked them. */
  readonly key: {
    readonly source: KeyJourneys['source'];
    readonly cards: readonly JourneyCard[];
    readonly unknown: readonly string[];
  };
  /** Where every journey and flow is listed. */
  readonly allJourneys: string;
  readonly teams: readonly TeamRow[];
}

const lowerFirst = (words: string): string => `${words.charAt(0).toLowerCase()}${words.slice(1)}`;

function headlineOf(workspace: Workspace): string {
  const systems = plural(systemsOf(workspace).length, 'system');
  const runs = `${workspace.name} runs ${systems} in ${plural(workspace.domains.length, 'domain')}`;
  const what = workspace.description?.trim().replace(/\.$/, '') ?? '';
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

function teamsOf(workspace: Workspace, model: Model): TeamRow[] {
  const run = workspace.domains.flatMap((domain) =>
    domain.systems.map((system) => ({ domain, system })),
  );
  return workspace.teams.map((team) => ({
    id: team.id,
    name: team.name,
    slot: teamIndex(model, team.id),
    channel: team.channel,
    systems: run
      .filter(({ system }) => system.team === team.id)
      .map(({ domain, system }) => ({
        name: system.name,
        href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      })),
  }));
}

/** The landscape of a workspace, read from its model of today. */
export function landscapeOf(workspace: Workspace, model: Model): Landscape {
  const journeys = journeyCardsOf(model, workspace.id, workspaceScopeOf(workspace));
  const key = keyJourneysOf(workspace, model);
  return {
    name: workspace.name,
    headline: headlineOf(workspace),
    facts: [
      plural(workspace.domains.length, 'domain'),
      plural(systemsOf(workspace).length, 'system'),
      plural(componentsOf(workspace).length, 'component'),
      plural(model.asIs.userJourneys.length, 'user journey'),
      plural(model.asIs.flows.length, 'flow'),
    ],
    map: landscapeMapInput(
      workspace,
      model,
      key.picked.map((k) => k.journey.key),
    ),
    journeys,
    allJourneys: journeysHref(workspace.id),
    key: {
      source: key.source,
      cards: key.picked.map((k) => ({
        ...journeyCardOf(model, workspace.id, k.journey),
        why: k.why,
      })),
      unknown: key.unknown,
    },
    teams: teamsOf(workspace, model),
  };
}
