// Named legacy workspace/domain pages can read a lossless carrier while their projections migrate.
import { indexOf } from '@/application/model-index';
import { derive, type Model } from '@/application/plan/derive';
import { stripPrefix } from '@/domain/ids';
import type { Field, Interface, Plan, Schema, Service, Store } from '@/domain/plan/plan.generated';
import type { Component, Domain, System, Team, Workspace } from '@/domain/workspace';
import {
  modelRecord,
  modelText,
  type ModelComponent,
  type ModelData,
  type ModelDomain,
  type ModelSystem,
  type WorkspaceModel,
} from '@/domain/workspace-model';

type Carrier<Value, View> = Value extends unknown ? Omit<Value, keyof View> & View : never;
type ComponentCarrier = Carrier<ModelComponent, Component>;
type SystemCarrier = Carrier<ModelSystem, System> & {
  readonly modelId: string;
  readonly modelNarratives: ModelSystem['narratives'];
  readonly components: readonly ComponentCarrier[];
};
type DomainCarrier = Carrier<ModelDomain, Domain> & {
  readonly modelId: string;
  readonly systems: readonly SystemCarrier[];
};
export type LegacyWorkspaceView = Carrier<WorkspaceModel, Workspace> & {
  readonly domains: readonly DomainCarrier[];
};
export interface LegacyLoss {
  readonly path: string;
  readonly message: string;
}
export interface LegacyView {
  readonly workspace: LegacyWorkspaceView;
  readonly model: Model;
  readonly losses: readonly LegacyLoss[];
}
function componentView(component: ModelComponent): ComponentCarrier {
  const type = { service: 'service', app: 'website', store: 'database', topic: 'queue' } as const;
  return {
    ...component,
    type: type[component.kind],
    tech: component.tech ?? null,
    does: component.does ?? null,
    talksTo: [],
  };
}
function systemView(system: ModelSystem): SystemCarrier {
  const { narratives, ...facts } = system;
  return {
    ...facts,
    modelId: system.id,
    modelNarratives: narratives,
    id: stripPrefix(system.id, 'sys'),
    team: system.team ?? null,
    runsOn: system.runs_on?.[0] === undefined ? null : stripPrefix(system.runs_on[0], 'sys'),
    repos: Object.values(system.homes ?? {}).flatMap((home) =>
      home === undefined ? [] : [{ ...home, path: home.path ?? null }],
    ),
    components: system.components.map(componentView),
  };
}
function teamView(team: ModelData<'Team'>): Team {
  const { contacts, ...facts } = team;
  return {
    ...facts,
    colour: team.colour ?? null,
    channel: team.channel ?? null,
    ...(contacts === undefined
      ? {}
      : { contacts: contacts.map((contact) => ({ ...contact, role: contact.role ?? null })) }),
  };
}
function workspaceView(model: WorkspaceModel): LegacyWorkspaceView {
  return {
    ...model,
    description: model.description ?? null,
    isPrivate: model.private ?? false,
    teams: (model.teams ?? []).map(teamView),
    actors: (model.actors ?? []).map((actor) => ({
      ...actor,
      summary: actor.summary ?? null,
      uses: actor.uses ?? [],
      customer: actor.customer ?? false,
    })),
    domains: model.domains.map((domain) => ({
      ...domain,
      modelId: domain.id,
      id: stripPrefix(domain.id, 'dom'),
      purpose: domain.purpose ?? null,
      systems: domain.systems.map(systemView),
    })),
  };
}
function carriedValue(
  key: string,
  expected: unknown,
  carrier: Readonly<Record<string, unknown>>,
): unknown {
  const actual = carrier[key];
  if (key === 'id' && carrier.modelId === expected) return carrier.modelId;
  return key === 'narratives' && actual === undefined ? carrier.modelNarratives : actual;
}
/** Every source leaf must still be carried, including metadata a legacy page does not yet display. */
export function legacyLosses(source: unknown, carrier: unknown, path = ''): readonly LegacyLoss[] {
  if (Array.isArray(source)) {
    if (!Array.isArray(carrier) || source.length !== carrier.length) {
      return [{ path, message: 'The legacy carrier changed a collection.' }];
    }
    return source.flatMap((value: unknown, index) =>
      legacyLosses(value, carrier[index], `${path}/${String(index)}`),
    );
  }
  const data = modelRecord(source);
  if (data === null) {
    return Object.is(source, carrier)
      ? []
      : [{ path, message: 'The legacy carrier did not retain this value.' }];
  }
  const target = modelRecord(carrier);
  if (target === null) return [{ path, message: 'The legacy carrier did not retain this object.' }];
  return Object.entries(data).flatMap(([key, value]) =>
    legacyLosses(value, carriedValue(key, value, target), `${path}/${key}`),
  );
}
function legacyService(component: ModelComponent, system: ModelSystem): readonly Service[] {
  if (component.kind !== 'service' && component.kind !== 'app') return [];
  return [
    {
      ...component,
      kind: component.kind === 'app' ? 'ui' : 'service',
      system: system.id,
      ...(system.team === undefined ? {} : { team: system.team }),
    },
  ];
}
function storeKind(kind: string | undefined): Store['kind'] | null {
  switch (kind) {
    case 'database':
    case 'cache':
    case 'warehouse':
    case 'bucket':
    case 'topic': {
      return kind;
    }
    default: {
      return null;
    }
  }
}
function legacyStore(
  component: ModelComponent,
  ownerOf: (id: string) => string | null,
): readonly Store[] {
  if (component.kind !== 'store' && component.kind !== 'topic') return [];
  const owner = ownerOf(component.id);
  const kind = storeKind(component.kind === 'topic' ? 'topic' : component.form);
  if (kind === null) return [];
  return [
    {
      id: component.id,
      name: component.name,
      kind,
      ...(component.tech === undefined ? {} : { tech: component.tech }),
      ...(component.does === undefined ? {} : { does: component.does }),
      ...(owner === null ? {} : { owner }),
    },
  ];
}
function typeLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'Unknown';
  return JSON.stringify(value);
}
function legacyField(field: ModelData<'Field'>): Field & { readonly id: string } {
  return {
    id: field.id,
    name: field.name,
    type: typeLabel(field.type),
    ...(field.required === undefined ? {} : { required: field.required }),
    ...(field.ref === undefined ? {} : { ref: field.ref }),
    ...(field.note === undefined ? {} : { note: field.note }),
  };
}
function legacySchema(schema: ModelData<'Schema'>): Schema {
  return {
    id: schema.id,
    name: schema.name ?? schema.id,
    kind: schema.kind,
    ...(schema.store === undefined ? {} : { store: schema.store }),
    ...(schema.graph === undefined ? {} : { graph: schema.graph }),
    fields: (schema.fields ?? []).map(legacyField),
  };
}
function entrySignature(value: unknown): string {
  const data = modelRecord(value);
  if (typeof data?.sig === 'string') return data.sig;
  if (typeof data?.method === 'string' && typeof data.path === 'string') {
    return `${data.method} ${data.path}`;
  }
  for (const key of ['signature', 'rpc', 'call']) {
    const signature = modelText(data?.[key]);
    if (signature !== null) return signature;
  }
  return modelText(data?.id) ?? 'Unknown entry';
}
function legacyInterface(item: ModelData<'Interface'>): readonly Interface[] {
  if (item.kind === 'sdk') return [];
  const data = modelRecord(item);
  const service = modelText(data?.component) ?? modelText(data?.external);
  if (service === null) throw new Error(`${item.id}: interface has no declared provider.`);
  return [
    {
      id: item.id,
      service,
      protocol: item.kind,
      endpoints: (item.entries ?? []).map((entry) => ({
        id: entry.id,
        sig: entrySignature(entry),
        ...(entry.request === undefined ? {} : { request: entry.request }),
        ...(entry.response === undefined ? {} : { response: entry.response }),
      })),
    },
  ];
}
function projection(model: WorkspaceModel, ownerOf: (id: string) => string | null): Plan {
  const systems = model.domains.flatMap((domain) => domain.systems);
  return {
    meta: { id: model.id, title: model.name, status: 'approved' },
    problem: { summary: model.description ?? model.name },
    teams: (model.teams ?? []).map((team) => ({ ...team })),
    systems: systems.map((system) => ({
      id: system.id,
      name: system.name,
      ...(system.team === undefined ? {} : { team: system.team }),
      ...(system.purpose === undefined ? {} : { does: system.purpose }),
    })),
    services: systems.flatMap((system) =>
      system.components.flatMap((component) => legacyService(component, system)),
    ),
    stores: systems.flatMap((system) =>
      system.components.flatMap((component) => legacyStore(component, ownerOf)),
    ),
    schemas: systems.flatMap((system) => system.schemas.map(legacySchema)),
    interfaces: systems.flatMap((system) => system.interfaces.flatMap(legacyInterface)),
    messages: systems.flatMap((system) =>
      system.messages.map((message) => ({ ...message, name: message.name ?? message.id })),
    ),
  };
}
/** Compatibility is confined to workspace/domain page consumers; canonical facets remain on their containing system. */
export function legacyViewOf(model: WorkspaceModel): LegacyView {
  const workspace = workspaceView(model);
  const index = indexOf(model);
  const placements = Object.fromEntries(index.entities.map((entity) => [entity.id, entity.place]));
  return {
    workspace,
    model: derive(projection(model, index.resourceOwner), { placements }),
    losses: legacyLosses(model, workspace),
  };
}
