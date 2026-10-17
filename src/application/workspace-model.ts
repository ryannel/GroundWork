// How the systems of a workspace work today, as one plan-shaped document with no changes, so every
// plan view (map, flows, contracts, screens) can draw it. The structure gives the components; the
// system model (contracts.yaml, story.yaml, flows/, journeys/) gives what they offer and keep.
import { derive, type Model } from '@/application/plan/derive';
import type { Plan, Service, Store } from '@/domain/plan/plan.generated';
import {
  type Component,
  type ComponentType,
  type System,
  systemsOf,
  type Workspace,
} from '@/domain/workspace';
import type {
  Attribution,
  ComponentDetail,
  DomainLanguage,
  KeyTerms,
  Scan,
  SystemContracts,
  WorkspaceModel,
} from '@/domain/workspace-model';

export interface SystemModel {
  readonly plan: Plan;
  readonly model: Model;
  /** Who said each fact and where in the code, by id. */
  readonly attribution: Readonly<Record<string, Attribution>>;
  /** The commit each repo was last read at. */
  readonly scans: readonly Scan[];
  /** Each domain's words, from its language.yaml. */
  readonly languages: readonly DomainLanguage[];
  /** The words the business has agreed on, from language.yaml at the root. */
  readonly keyTerms: KeyTerms;
}

const SERVICE_KIND: Record<ComponentType, Service['kind'] | null> = {
  website: 'ui',
  service: 'service',
  job: 'job',
  external: 'external',
  library: 'service',
  database: null,
  queue: null,
};

const STORE_KIND: Partial<Record<ComponentType, Store['kind']>> = {
  database: 'database',
  queue: 'topic',
};

export function systemModelOf(workspace: Workspace, model: WorkspaceModel): SystemModel {
  const plan = systemPlanOf(workspace, model);
  return {
    plan,
    model: derive(plan),
    attribution: model.attribution,
    scans: model.scans,
    languages: model.languages,
    keyTerms: model.keyTerms,
  };
}

function systemPlanOf(workspace: Workspace, model: WorkspaceModel): Plan {
  const contracts = new Map(model.contracts.map((entry) => [entry.system, entry]));
  const systems = systemsOf(workspace);
  const parts = systems.map((system) => partsOf(system, contracts.get(system.id)));
  const each = model.contracts;
  return {
    meta: { id: workspace.id, title: workspace.name, status: 'approved' },
    problem: { summary: workspace.description ?? `How the systems of ${workspace.name} work.` },
    domain: {
      ...(model.story.summary === null ? {} : { summary: model.story.summary }),
      concepts: [...model.story.concepts, ...model.languages.flatMap(({ concepts }) => concepts)],
      stages: [...model.story.stages],
    },
    teams: workspace.teams.map(({ id, name, colour, channel }) => ({
      id,
      name,
      ...(channel === null ? {} : { channel }),
      ...(colour === null ? {} : { colour }),
    })),
    systems: systems.map((system) => ({
      id: `sys:${system.id}`,
      name: system.name,
      team: teamOf(system),
      ...(system.repos.length === 0 ? {} : { sources: system.repos.map(repoSource) }),
    })),
    services: parts.flatMap(({ services }) => services),
    stores: parts.flatMap(({ stores }) => stores),
    schemas: each.flatMap(({ schemas }) => schemas),
    interfaces: each.flatMap(({ interfaces }) => interfaces),
    messages: each.flatMap(({ messages }) => messages),
    flows: [...model.flows],
    screens: each.flatMap(({ screens }) => screens),
    interactions: [...model.interactions],
    user_journeys: [...model.journeys],
    graphs: each.flatMap(({ graphs }) => graphs),
    subgraphs: each.flatMap(({ subgraphs }) => subgraphs),
    operations: each.flatMap(({ operations }) => operations),
  };
}

// A system's repos are the evidence that its components belong together.
function repoSource(repo: string): { readonly url: string } {
  return { url: repo.includes('://') ? repo : `https://github.com/${repo}` };
}

function teamOf(system: System): string {
  if (system.team === null) throw new Error(`system ${system.id} has no team`);
  return system.team;
}

function partsOf(
  system: System,
  contracts: SystemContracts | undefined,
): { readonly services: readonly Service[]; readonly stores: readonly Store[] } {
  const detail = new Map((contracts?.components ?? []).map((entry) => [entry.id, entry]));
  const kept = new Map((contracts?.stores ?? []).map((entry) => [entry.id, entry]));
  const services: Service[] = [];
  const stores: Store[] = [];
  for (const component of system.components) {
    const kind = SERVICE_KIND[component.type];
    if (kind === null) stores.push(storeOf(component, system, kept.get(component.id)));
    else services.push(serviceOf(component, system, detail.get(component.id)));
  }
  return { services, stores };
}

// The structure names a component and says what it does; the system model adds the rest.
function serviceOf(
  component: Component,
  system: System,
  detail: ComponentDetail | undefined,
): Service {
  return {
    id: component.id,
    name: component.name,
    team: teamOf(system),
    system: `sys:${system.id}`,
    kind: detail?.kind ?? SERVICE_KIND[component.type] ?? 'service',
    ...plainWords(component),
    ...(detail?.summary === undefined ? {} : { summary: detail.summary }),
    ...(detail?.sources === undefined ? {} : { sources: [...detail.sources] }),
  };
}

function storeOf(component: Component, system: System, kept: Store | undefined): Store {
  const owner = system.components.find(({ type }) => SERVICE_KIND[type] !== null)?.id;
  if (kept === undefined && owner === undefined) {
    throw new Error(`store ${component.id} has no owner: system ${system.id} has no service`);
  }
  return {
    kind: STORE_KIND[component.type] ?? 'database',
    owner: owner ?? '',
    ...kept,
    id: component.id,
    name: component.name,
    ...plainWords(component),
  };
}

function plainWords(component: Component): { readonly tech?: string; readonly does?: string } {
  return {
    ...(component.tech === null ? {} : { tech: component.tech }),
    ...(component.does === null ? {} : { does: component.does }),
  };
}
