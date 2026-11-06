import { areaNarratives, type AreaNarratives } from '@/application/area-map/narratives';
import { resourcesOf, withAreaResources } from '@/application/area-map/resources';
import { explorerComponentLinks } from '@/application/explorer-component-links';
import { serviceExplorerHref } from '@/application/explorer-location';
import type { Model } from '@/application/plan/derive';
import { homeUrlOf } from '@/domain/code-links';
import { stripPrefix } from '@/domain/ids';
import type {
  AuthoredLandscape,
  LandscapeArea,
  LandscapeCollaboration,
  LandscapeSystemRelationship,
  LandscapeValueFlow,
} from '@/domain/landscape';
import type { ExplorerManifest } from '@/domain/service-explorer';
import {
  type Component,
  type ComponentType,
  type System,
  type Workspace,
  systemDoes,
} from '@/domain/workspace';
import type { Attribution } from '@/domain/workspace-model';
import { plural } from '@/shared/text';

import {
  areaTechnicalRelationships,
  type AreaTechnicalRelationship,
} from './workspace-area-relationships';
import { systemHref, workspaceHref } from './workspace-paths';

export type { AreaTechnicalRelationship } from './workspace-area-relationships';

export interface AreaComponentView {
  readonly parentComponent?: string;
  readonly attachments?: readonly AreaComponentView[];
  readonly id: string;
  readonly name: string;
  readonly kind: ComponentType;
  readonly infrastructure?: boolean;
  readonly summary: string;
  readonly technology?: string | null;
  readonly category?: string;
  readonly explorer: string | null;
  readonly repository: { readonly name: string; readonly href: string } | null;
  readonly endpoints: readonly AreaEndpointView[];
  readonly resources: readonly AreaResourceView[];
  readonly dependencies: readonly AreaDependencyView[];
}

export interface AreaCallerView {
  readonly id: string;
  readonly name: string;
  readonly system: string | null;
  readonly systemName: string | null;
}

export interface AreaEndpointView {
  readonly id: string;
  readonly signature: string;
  readonly protocol?: 'rest' | 'grpc' | 'graphql' | 'https';
  readonly version?: string;
  readonly summary: string;
  readonly request: string | null;
  readonly response: string | null;
  readonly callers: readonly AreaCallerView[];
  readonly explorer: string | null;
}

export interface AreaResourceView {
  readonly id: string;
  readonly name: string;
  readonly kind: 'store' | 'topic';
  readonly use: string;
  readonly technology?: string | null;
  readonly category?: string;
}

export interface AreaDependencyView {
  readonly id: string;
  readonly name: string;
  readonly system: string | null;
  readonly systemName: string | null;
  readonly endpointId: string | null;
  readonly endpoint: string | null;
}

export interface AreaSystemView {
  readonly narratives?: AreaNarratives;
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly href: string;
  readonly components: readonly AreaComponentView[];
  readonly resources: readonly string[];
}

export interface AreaView {
  readonly valueFlow?: LandscapeValueFlow | undefined;
  readonly workspace: { readonly id: string; readonly name: string; readonly href: string };
  readonly area: LandscapeArea;
  readonly reviewed: string;
  readonly scope: string;
  readonly limitation: string;
  readonly systems: readonly AreaSystemView[];
  readonly relationships: readonly LandscapeSystemRelationship[];
  readonly technicalRelationships: readonly AreaTechnicalRelationship[];
  readonly collaborations: readonly LandscapeCollaboration[];
}

const DEPLOYABLES = new Set<ComponentType>(['service', 'website', 'job']);

interface AreaJoin {
  readonly workspace: Workspace;
  readonly manifest: ExplorerManifest | null;
  readonly model: Model | undefined;
  readonly links: Readonly<Record<string, string>>;
  readonly caller: (id: string) => AreaCallerView;
  readonly attribution?: Readonly<Record<string, Attribution>> | undefined;
}

function componentRepository(
  component: Component,
  join: AreaJoin,
): AreaComponentView['repository'] {
  const sources = new Set(
    (join.attribution?.[component.id]?.sources ?? []).map((source) => source.repo),
  );
  if (sources.size > 1) return null;
  const published =
    join.manifest?.services.filter(
      (service) => service.id === component.id || service.id === stripPrefix(component.id, 'svc'),
    ) ?? [];
  const name = [...sources][0] ?? (published.length === 1 ? published[0]?.repo : undefined);
  if (name === undefined) return null;
  return {
    name,
    href: homeUrlOf({ repo: name }),
  };
}

function componentView(component: Component, join: AreaJoin): AreaComponentView {
  return {
    id: component.id,
    name: component.name,
    kind: component.type,
    ...(component.infrastructure === true ? { infrastructure: true } : {}),
    summary: component.does ?? 'Purpose not described yet.',
    technology: component.tech,
    explorer: join.links[component.id] ?? null,
    repository: componentRepository(component, join),
    endpoints: endpointsOf(component, join),
    resources: resourcesOf(component.id, join.model),
    dependencies: dependenciesOf(component, join.workspace, join.model),
  };
}

function systemNameOf(workspace: Workspace, id: string | null | undefined): string | null {
  if (id === undefined || id === null) return null;
  const key = stripPrefix(id, 'sys');
  return (
    workspace.domains.flatMap((domain) => domain.systems).find((system) => system.id === key)
      ?.name ?? null
  );
}

function callerLookup(workspace: Workspace, model?: Model): (id: string) => AreaCallerView {
  const callers = new Map<string, AreaCallerView>();
  return (id) => {
    const known = callers.get(id);
    if (known !== undefined) return known;
    const component = model?.asIs.get(id);
    const system =
      component?.$type === 'service' ? (stripPrefix(component.system, 'sys') ?? null) : null;
    const caller = {
      id,
      name: model?.label(id) ?? id,
      system,
      systemName: systemNameOf(workspace, system),
    };
    callers.set(id, caller);
    return caller;
  };
}

function endpointKey(value: string): string {
  const [method = '', path = ''] = value.trim().split(/\s+/u);
  return `${method.toUpperCase()}:${path.split('/').at(-1)?.toLowerCase() ?? ''}`;
}

function endpointExplorer(
  manifest: ExplorerManifest | null,
  component: string,
  signature: string,
): string | null {
  if (manifest === null) return null;
  const id = stripPrefix(component, 'svc');
  const service = manifest.services.find((item) => item.id === id || item.id === component);
  const entry = service?.entries.find((item) => endpointKey(item.label) === endpointKey(signature));
  if (service === undefined || entry === undefined) return null;
  return `${serviceExplorerHref(manifest.workspace, service.id)}&page=${encodeURIComponent(entry.file)}`;
}

function endpointsOf(component: Component, join: AreaJoin): readonly AreaEndpointView[] {
  const { manifest, model } = join;
  if (model === undefined) return [];
  const graph = model.asIs;
  const edges = model.edges('asIs', 'api');
  return graph.interfaces
    .filter((entry) => entry.service === component.id)
    .flatMap((entry) =>
      entry.endpoints.map((endpoint) => ({
        ...endpoint,
        protocol: entry.protocol,
        version: entry.version,
      })),
    )
    .map((endpoint) => ({
      id: endpoint.id,
      signature: endpoint.sig,
      protocol: endpoint.protocol,
      ...(endpoint.version === undefined ? {} : { version: endpoint.version }),
      summary: endpoint.summary ?? 'Purpose not described yet.',
      request: endpoint.request ?? null,
      response: endpoint.response ?? null,
      callers: edges
        .filter((edge) => edge.to === component.id && edge.via === endpoint.id)
        .map((edge) => join.caller(edge.from)),
      explorer: endpointExplorer(manifest, component.id, endpoint.sig),
    }));
}

const dependencySystem = (workspace: Workspace, component: string): string | null =>
  workspace.domains
    .flatMap((domain) => domain.systems)
    .find((system) =>
      system.components.some((item) => item.id === component && DEPLOYABLES.has(item.type)),
    )?.id ?? null;

function dependenciesOf(
  component: Component,
  workspace: Workspace,
  model?: Model,
): readonly AreaDependencyView[] {
  if (model === undefined) return [];
  const graph = model.asIs;
  const seen = new Set<string>();
  return model
    .edges('asIs', 'api')
    .filter((edge) => edge.from === component.id)
    .flatMap((edge): readonly AreaDependencyView[] => {
      const key = `${edge.to}|${edge.via ?? ''}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const target = graph.get(edge.via);
      const system = dependencySystem(workspace, edge.to);
      return [
        {
          id: edge.to,
          name: model.label(edge.to),
          system,
          systemName: systemNameOf(workspace, system),
          endpointId: target?.$type === 'endpoint' ? target.id : null,
          endpoint: target?.$type === 'endpoint' ? target.sig : null,
        },
      ];
    });
}

function resourceFacts(system: System): readonly string[] {
  const count = (kind: ComponentType): number =>
    system.components.filter((component) => component.type === kind).length;
  const stores = count('database');
  const topics = count('queue');
  const externals = count('external');
  return [
    ...(stores === 0 ? [] : [plural(stores, 'store')]),
    ...(topics === 0 ? [] : [plural(topics, 'topic')]),
    ...(externals === 0 ? [] : [plural(externals, 'outside dependency', 'outside dependencies')]),
  ];
}

function systemView(system: System, join: Omit<AreaJoin, 'links'>): AreaSystemView | null {
  const { workspace, manifest } = join;
  const domain = workspace.domains.find((each) => each.systems.includes(system));
  if (domain === undefined) return null;
  const components = system.components.filter((component) => component.type !== 'library');
  const links = explorerComponentLinks(
    manifest,
    components.map((component) => component.id),
  );
  return {
    id: system.id,
    narratives: areaNarratives(system, join.model),
    name: system.name,
    purpose: systemDoes(system),
    href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
    components: components.map((component) => componentView(component, { ...join, links })),
    resources: resourceFacts(system),
  };
}

/** One authored area joined back to the independent systems it references. */
export function areaViewOf(options: {
  readonly workspace: Workspace;
  readonly landscape: AuthoredLandscape;
  readonly area: string;
  readonly explorer: ExplorerManifest | null;
  readonly model?: Model;
  readonly attribution?: Readonly<Record<string, Attribution>>;
}): AreaView | null {
  const { workspace, landscape, explorer, model } = options;
  const area = landscape.areas.find((each) => each.id === options.area);
  if (area === undefined) return null;
  const detail = landscape.details.find((each) => each.area === area.id);
  const byId = new Map(
    workspace.domains.flatMap((domain) => domain.systems.map((system) => [system.id, system])),
  );
  // Reuse caller identities across endpoints so the page transports each description once.
  const caller = callerLookup(workspace, model);
  const systems = withAreaResources(
    [
      ...new Set([...(detail?.systems ?? []), ...referencedSystems(detail?.valueFlow, model)]),
    ].flatMap((id) => {
      const system = byId.get(id);
      const view =
        system === undefined
          ? null
          : systemView(system, {
              workspace,
              manifest: explorer,
              model,
              caller,
              attribution: options.attribution,
            });
      return view === null ? [] : [view];
    }),
    model,
  );
  return {
    workspace: { id: workspace.id, name: workspace.name, href: workspaceHref(workspace.id) },
    area,
    reviewed: landscape.reviewed,
    scope: landscape.scope,
    limitation: landscape.limitation,
    systems,
    relationships: detail?.relationships ?? [],
    technicalRelationships: areaTechnicalRelationships(systems, model),
    collaborations: detail?.collaborations ?? [],
    valueFlow: checkedValueFlow(detail?.valueFlow, systems, model),
  };
}

/** A saved diagram may reference a resource outside its selected systems: retain its actual boundary. */
function referencedSystems(
  value: LandscapeValueFlow | undefined,
  model: Model | undefined,
): readonly string[] {
  if (value === undefined || model === undefined) return [];
  const components = [
    ...value.bands.flatMap((band) => band.nodes.map((node) => node.component)),
    ...[...value.connections, ...(value.summaries ?? []), ...(value.overview ?? [])].flatMap(
      (connection) => [connection.from, connection.to],
    ),
  ];
  return components.flatMap((id) => {
    const system = model.place(id)?.system;
    return system === undefined || system === null ? [] : [stripPrefix(system, 'sys')];
  });
}

/** Saved value-flow references must resolve; a diagram cannot manufacture a missing component. */
function checkedValueFlow(
  value: LandscapeValueFlow | undefined,
  systems: readonly AreaSystemView[],
  model: Model | undefined,
): LandscapeValueFlow | undefined {
  if (value === undefined) return undefined;
  const ids = new Set(
    systems.flatMap((system) => system.components.map((component) => component.id)),
  );
  const core = value.bands.flatMap((band) => band.nodes.map((node) => node.component));
  const invalid = core.some((id) => !ids.has(id)) || new Set(core).size !== core.length;
  const broken = [...value.connections, ...(value.summaries ?? []), ...(value.overview ?? [])].some(
    (connection) =>
      !ids.has(connection.from) ||
      !ids.has(connection.to) ||
      connection.evidence.some((id) => model?.asIs.get(id) === undefined),
  );
  const invented = value.overview?.some(
    (entry) =>
      !value.connections.some(
        (connection) =>
          connection.from === entry.from &&
          connection.to === entry.to &&
          connection.kind === entry.kind,
      ),
  );
  const columns = value.columns ?? [];
  const misplaced =
    columns.some((entry) => !systems.some((system) => system.id === entry.system)) ||
    new Set(columns.map((entry) => entry.system)).size !== columns.length;
  if (misplaced) return undefined;
  return invalid || broken || invented === true ? undefined : value;
}
