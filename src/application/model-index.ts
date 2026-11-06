// All model queries share declared identity, file placement and recorded execution detail.
import {
  graphqlGaps,
  graphqlReaches,
  selectedGraphFields as selectedFields,
  type GraphqlReach,
} from '@/application/model-graphql';
import { resolveAlias, rootId, stripPrefix, type Alias } from '@/domain/ids';
import {
  entitiesIn,
  modelList,
  modelRecord,
  modelText,
  type ModelCite,
  type ModelEntity,
  type ModelGap,
  type ModelHandler,
  type ModelPlace,
  type ModelRepository,
  type WorkspaceModel,
} from '@/domain/workspace-model';

export type ModelEdgeKind = 'call' | 'publish' | 'consume' | 'read' | 'write' | 'causes';
export interface ModelEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ModelEdgeKind;
  readonly via: string;
  readonly site: string;
  readonly handler: string | null;
  readonly entry: string | null;
  readonly cites: readonly ModelCite[];
  readonly source: 'handler' | 'relationship' | 'subscription' | 'operation';
}
export interface EdgeOptions {
  readonly level?: 'component' | 'system';
  readonly direction?: 'in' | 'out' | 'both';
  readonly kinds?: readonly ModelEdgeKind[];
}
export interface EntryFlow {
  readonly entry: ModelEntity;
  readonly handlers: readonly ModelHandler[];
  readonly callers: readonly ModelEdge[];
  readonly reaches: readonly ModelEdge[];
  readonly gaps: readonly ModelGap[];
}
export interface ModelIndex {
  readonly model: WorkspaceModel;
  readonly entities: readonly ModelEntity[];
  readonly get: (id: string) => ModelEntity | null;
  readonly label: (id: string) => string;
  readonly href: (id: string) => string;
  readonly place: (id: string) => ModelPlace | null;
  readonly owningTeam: (id: string) => string | null;
  readonly resourceOwner: (id: string) => string | null;
  readonly codeHomes: (
    id: string,
  ) => readonly { readonly key: string; readonly repo: string; readonly path?: string }[];
  readonly cites: (id: string) => readonly ModelCite[];
  readonly edges: (id?: string, options?: EdgeOptions) => readonly ModelEdge[];
  readonly callers: (entry: string) => readonly ModelEdge[];
  readonly entries: (component?: string) => readonly ModelEntity[];
  readonly roles: (component: string) => readonly ('api' | 'worker' | 'job')[];
  readonly producers: (message: string) => readonly string[];
  readonly consumers: (message: string) => readonly string[];
  readonly storeAccess: (store: string) => readonly ModelEdge[];
  readonly fieldsReached: (operation: string) => readonly GraphqlReach[];
  readonly freshness: (id: string) => readonly ModelRepository['repository'][];
  readonly flowOf: (entry: string) => EntryFlow | null;
  readonly gaps: (id?: string) => readonly ModelGap[];
}
interface Lookup {
  readonly model: WorkspaceModel;
  readonly nodes: readonly ModelEntity[];
  readonly get: ModelIndex['get'];
  readonly cites: ModelIndex['cites'];
}
const ENTRIES = new Set(['endpoint', 'subscription', 'job', 'interaction']);

function codeCite(data: Readonly<Record<string, unknown>>): ModelCite | null {
  const { repo, commit, path, symbol } = data;
  if (typeof repo !== 'string' || typeof commit !== 'string' || typeof path !== 'string') {
    return null;
  }
  const base = {
    ...data,
    kind: 'code' as const,
    repo,
    commit,
    path,
    ...(typeof symbol === 'string' ? { symbol } : {}),
  };
  const lines = modelList(data.lines);
  if (lines.length === 2 && typeof lines[0] === 'number' && typeof lines[1] === 'number') {
    return { ...base, lines: [lines[0], lines[1]] };
  }
  return base;
}
function citeValues(value: unknown): readonly ModelCite[] {
  return modelList(value).flatMap((candidate): readonly ModelCite[] => {
    const data = modelRecord(candidate);
    if (data === null) return [];
    if (data.kind === 'evidence' && typeof data.id === 'string') {
      return [{ ...data, kind: 'evidence', id: data.id }];
    }
    const code = data.kind === 'code' ? codeCite(data) : null;
    return code === null ? [] : [code];
  });
}
function createLookup(model: WorkspaceModel): Lookup {
  const aliases: Readonly<Record<string, Alias>> = Object.fromEntries(
    Object.entries(model.aliases).flatMap(([id, alias]) =>
      alias === undefined ? [] : [[id, alias]],
    ),
  );
  const nodes = entitiesIn(model).map((node) => ({
    ...node,
    place: {
      ...node.place,
      component:
        node.place.component === null ? null : resolveAlias(node.place.component, aliases).id,
    },
  }));
  const byId = new Map<string, ModelEntity>();
  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`Duplicate model id: ${node.id}`);
    byId.set(node.id, node);
  }
  const get = (id: string): ModelEntity | null => {
    const resolved = resolveAlias(id, aliases);
    return resolved.id === null ? null : (byId.get(resolved.id) ?? null);
  };
  const cites = (id: string): readonly ModelCite[] => {
    let node = get(id);
    while (node !== null) {
      const own = citeValues(node.data.cites);
      if (own.length > 0) return own;
      node = node.parent === null ? null : get(node.parent);
    }
    return [];
  };
  return { model, nodes, get, cites };
}
function text(data: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  return modelText(data?.[key]);
}
function canonicalId(id: string | null, lookup: Lookup): string | null {
  return id === null ? null : (lookup.get(id)?.id ?? null);
}
function componentOf(id: string, lookup: Lookup): string | null {
  const node = lookup.get(id);
  if (node === null) return null;
  if (['service', 'app', 'store', 'topic', 'external', 'system'].includes(node.kind)) {
    return node.id;
  }
  if (node.kind === 'message') return canonicalId(text(node.data, 'topic'), lookup);
  if (node.kind === 'schema' || node.kind === 'field') {
    const schema = lookup.get(rootId(node.id));
    return canonicalId(text(schema?.data, 'store'), lookup) ?? node.place.component;
  }
  if (node.kind === 'endpoint' && node.parent !== null) {
    const provider = lookup.get(node.parent)?.data;
    return canonicalId(text(provider, 'component') ?? text(provider, 'external'), lookup);
  }
  return node.place.component;
}
function handlersIn(model: WorkspaceModel): readonly ModelHandler[] {
  return model.domains.flatMap((domain) => domain.systems.flatMap((system) => system.handlers));
}
function edge(
  lookup: Lookup,
  site: ModelEntity,
  kind: ModelEdgeKind,
  from: string,
  to: string,
  via: string,
  source: ModelEdge['source'],
): ModelEdge {
  const handler = site.kind === 'step' ? lookup.get(rootId(site.id)) : null;
  return {
    from,
    to,
    kind,
    via,
    site: site.id,
    handler: handler?.kind === 'handler' ? handler.id : null,
    entry: canonicalId(text(handler?.data, 'on'), lookup),
    cites: lookup.cites(site.id),
    source,
  };
}
function resolvesEntry(reach: GraphqlReach, entry: ModelEntity, lookup: Lookup): boolean {
  const provider = lookup.get(entry.parent ?? '');
  if (provider?.data.kind !== 'graphql' || provider.data.subgraph !== reach.subgraph) return false;
  const field = lookup.get(reach.field);
  const schema = lookup.get(rootId(reach.field));
  const type = text(schema?.data, 'name');
  const name = text(field?.data, 'name');
  return type !== null && name !== null && entry.data.field === `${type}.${name}`;
}
function graphqlCaller(entry: ModelEntity, record: ModelEdge, lookup: Lookup): boolean {
  if (record.source !== 'operation') return false;
  const operation = lookup.get(record.via);
  if (operation === null) return false;
  if (componentOf(operation.id, lookup) !== record.from) return false;
  return graphqlReaches(operation, lookup).some((reach) => resolvesEntry(reach, entry, lookup));
}
function callersOf(
  entry: string,
  lookup: Lookup,
  records: readonly ModelEdge[],
): readonly ModelEdge[] {
  const node = lookup.get(entry);
  const id = node?.id ?? entry;
  return records.filter(
    (record) =>
      record.kind === 'call' &&
      (record.via === id || (node?.kind === 'endpoint' && graphqlCaller(node, record, lookup))),
  );
}
function incoming(
  entry: ModelEntity,
  lookup: Lookup,
  records: readonly ModelEdge[],
): readonly ModelEdge[] {
  if (entry.kind !== 'subscription') return callersOf(entry.id, lookup, records);
  return records.filter((record) => record.kind === 'publish' && record.via === entry.data.message);
}
function compositionGaps(lookup: Lookup): readonly ModelGap[] {
  return lookup.nodes
    .filter((node) => node.kind === 'operation')
    .flatMap((operation) => graphqlGaps(operation, lookup));
}
function operationEdges(lookup: Lookup): readonly ModelEdge[] {
  return lookup.nodes
    .filter((node) => node.kind === 'operation')
    .flatMap((operation) => {
      const from = componentOf(operation.id, lookup);
      const graph = lookup.get(text(operation.data, 'graph') ?? '');
      const gateway = canonicalId(text(graph?.data, 'gateway'), lookup);
      if (from === null || gateway === null) return [];
      const reached = graphqlReaches(operation, lookup);
      return [
        edge(lookup, operation, 'call', from, gateway, operation.id, 'operation'),
        ...reached
          .filter((reach) => reach.component !== gateway)
          .map((reach) =>
            edge(lookup, operation, 'call', gateway, reach.component, operation.id, 'operation'),
          ),
      ];
    });
}
function stepEdges(lookup: Lookup, report: (problem: ModelGap) => void): readonly ModelEdge[] {
  return lookup.nodes
    .filter((node) => node.kind === 'step' && lookup.get(rootId(node.id))?.kind === 'handler')
    .flatMap((step) => {
      const from = step.place.component;
      if (from === null) return [];
      const effects = [
        ['read', step.data.from, step.data.read],
        ['write', step.data.to, step.data.write],
        ['call', step.data.call, step.data.call],
        ['publish', step.data.publish, step.data.publish],
        ['causes', step.data.causes, step.data.causes],
      ] as const;
      return effects.flatMap(([kind, target, via]) => {
        if (typeof target !== 'string' || typeof via !== 'string') return [];
        const actual = lookup.get(target);
        const destination =
          actual?.kind === 'operation'
            ? canonicalId(
                text(lookup.get(text(actual.data, 'graph') ?? '')?.data, 'gateway'),
                lookup,
              )
            : componentOf(target, lookup);
        if (destination === null || lookup.get(destination) === null) {
          report({
            id: step.id,
            kind: 'unmapped_target',
            reference: target,
            message: 'The effect target has no recorded component.',
          });
          return [];
        }
        return [
          edge(lookup, step, kind, from, destination, canonicalId(via, lookup) ?? via, 'handler'),
        ];
      });
    });
}
function subscriptionEdges(
  lookup: Lookup,
  report: (problem: ModelGap) => void,
): readonly ModelEdge[] {
  return lookup.nodes
    .filter((node) => node.kind === 'subscription')
    .flatMap((subscription) => {
      const message = lookup.get(text(subscription.data, 'message') ?? '');
      const from = canonicalId(text(message?.data, 'topic'), lookup);
      const to = canonicalId(text(subscription.data, 'component'), lookup);
      if (from === null || to === null) {
        report({
          id: subscription.id,
          kind: 'unmapped_target',
          message: 'The subscription has no recorded message topic or receiver.',
        });
        return [];
      }
      return [edge(lookup, subscription, 'consume', from, to, message?.id ?? '', 'subscription')];
    });
}
function sameDestination(actual: string, target: string, lookup: Lookup): boolean {
  if (actual === target) return true;
  return lookup.get(target)?.kind === 'system' && lookup.get(actual)?.place.system === target;
}
function relationEdges(lookup: Lookup, detail: readonly ModelEdge[]): readonly ModelEdge[] {
  return lookup.nodes
    .filter((node) => node.kind === 'relationship')
    .flatMap((relation): readonly ModelEdge[] => {
      const from = canonicalId(text(relation.data, 'from'), lookup);
      const target = text(relation.data, 'to');
      const kind = relation.data.kind;
      if (
        from === null ||
        target === null ||
        !['call', 'publish', 'consume', 'read', 'write'].includes(String(kind))
      ) {
        return [];
      }
      const to = componentOf(target, lookup) ?? target;
      const duplicate = detail.some(
        (record) =>
          record.from === from && sameDestination(record.to, to, lookup) && record.kind === kind,
      );
      if (duplicate) {
        throw new Error(
          `${relation.id}: a relationship duplicates recorded handler or operation detail.`,
        );
      }
      const cites = lookup.cites(relation.id);
      const common = {
        via: target,
        site: relation.id,
        handler: null,
        entry: null,
        cites,
        source: 'relationship',
      } as const;
      if (kind === 'consume') return [{ ...common, from: to, to: from, kind }];
      if (kind === 'call' || kind === 'publish' || kind === 'read' || kind === 'write') {
        return [{ ...common, from, to, kind }];
      }
      return [];
    });
}
function systemEdges(records: readonly ModelEdge[], lookup: Lookup): readonly ModelEdge[] {
  return records.flatMap((record) => {
    const from = lookup.get(record.from)?.place.system;
    const target = lookup.get(record.to);
    const to = target?.kind === 'external' ? target.id : target?.place.system;
    if (from === undefined || from === null) return [];
    if (to === undefined || to === null || from === to) return [];
    return [{ ...record, from, to }];
  });
}
function chooseEdges(
  records: readonly ModelEdge[],
  id: string | undefined,
  options: EdgeOptions,
): readonly ModelEdge[] {
  const direction = options.direction ?? 'both';
  return records.filter((record) => {
    if (options.kinds !== undefined && !options.kinds.includes(record.kind)) return false;
    if (id === undefined) return true;
    if (direction === 'in') return record.to === id;
    return direction === 'out' ? record.from === id : record.from === id || record.to === id;
  });
}
function homesFor(id: string, lookup: Lookup): ReturnType<ModelIndex['codeHomes']> {
  const node = lookup.get(id);
  if (node === null) return [];
  const system = lookup.get(node.place.system ?? '');
  const declared = modelRecord(system?.data.homes);
  if (declared === null) return [];
  const available = Object.entries(declared).flatMap(([key, value]) => {
    const home = modelRecord(value);
    const repo = modelText(home?.repo);
    const path = modelText(home?.path);
    return repo === null ? [] : [{ key, repo, ...(path === null ? {} : { path }) }];
  });
  if (node.kind === 'system') return available;
  const component = lookup.get(node.place.component ?? '');
  const keys = modelList(component?.data.homes);
  if (keys.length > 0) return available.filter((home) => keys.includes(home.key));
  return available.length === 1 ? available : [];
}
function labelOf(id: string, lookup: Lookup): string {
  const node = lookup.get(id);
  if (node === null) return id;
  for (const key of ['name', 'summary', 'does', 'purpose', 'says']) {
    const value = modelText(node.data[key]);
    if (value !== null) return value;
  }
  const method = modelText(node.data.method);
  const path = modelText(node.data.path);
  return method !== null && path !== null ? `${method} ${path}` : node.id;
}
function hrefOf(id: string, lookup: Lookup): string {
  const node = lookup.get(id);
  const base = `/${encodeURIComponent(lookup.model.id)}/`;
  if (node === null) return `${base}things/?id=${encodeURIComponent(id)}`;
  if (ENTRIES.has(node.kind)) return `${base}entries/?id=${encodeURIComponent(node.id)}`;
  const handler = lookup.get(rootId(node.id));
  if (handler?.kind === 'handler') {
    return `${base}entries/?id=${encodeURIComponent(text(handler.data, 'on') ?? '')}&step=${encodeURIComponent(node.id)}`;
  }
  if (node.kind === 'workspace') return base;
  const domain = node.place.domain;
  if (domain !== null && node.kind === 'domain') {
    return `${base}${encodeURIComponent(stripPrefix(domain, 'dom'))}/`;
  }
  if (domain !== null && node.kind === 'system') {
    return `${base}${encodeURIComponent(stripPrefix(domain, 'dom'))}/${encodeURIComponent(stripPrefix(node.id, 'sys'))}/`;
  }
  return `${base}things/?id=${encodeURIComponent(node.id)}`;
}

function resourceOwnerOf(id: string, lookup: Lookup): string | null {
  const node = lookup.get(id);
  if (node === null || !['store', 'topic'].includes(node.kind)) return null;
  const owner = modelRecord(node.data.owner);
  return citeValues(owner?.cites).length === 0 ? null : canonicalId(modelText(owner?.id), lookup);
}
function teamOf(id: string, lookup: Lookup): string | null {
  const system = lookup.get(lookup.get(id)?.place.system ?? '');
  return canonicalId(text(system?.data, 'team'), lookup);
}
function rolesOf(component: string, lookup: Lookup): ReturnType<ModelIndex['roles']> {
  const kinds = new Set(
    lookup.nodes.filter((node) => node.place.component === component).map((node) => node.kind),
  );
  const roles: ('api' | 'worker' | 'job')[] = [];
  if (kinds.has('endpoint')) roles.push('api');
  if (kinds.has('subscription')) roles.push('worker');
  if (kinds.has('job')) roles.push('job');
  return roles;
}
function missingDetail(
  node: ModelEntity,
  lookup: Lookup,
  records: readonly ModelEdge[],
): readonly ModelGap[] {
  const gaps: ModelGap[] = [];
  const add = (kind: string, message: string): void => {
    gaps.push({ id: node.id, kind, message });
  };
  if (node.kind === 'endpoint' && callersOf(node.id, lookup, records).length === 0) {
    add('no_caller', 'No caller is recorded.');
  }
  if (
    node.kind === 'message' &&
    !records.some((record) => record.via === node.id && record.kind === 'consume')
  ) {
    add('no_consumer', 'No consumer is recorded.');
  }
  if (
    ENTRIES.has(node.kind) &&
    !handlersIn(lookup.model).some((handler) => canonicalId(handler.on, lookup) === node.id)
  ) {
    add('no_handler', 'No handler detail is recorded.');
  }
  if (node.kind === 'operation' && selectedFields(node, lookup).length === 0) {
    add(
      'unmapped_target',
      'No graph fields can be resolved from the operation document and composition.',
    );
  }
  return gaps;
}
function uncitedEffect(node: ModelEntity): readonly ModelGap[] {
  if (node.kind !== 'step') return [];
  const effect = ['call', 'read', 'write', 'publish', 'causes'].some(
    (key) => typeof node.data[key] === 'string',
  );
  return effect && citeValues(node.data.cites).length === 0
    ? [{ id: node.id, kind: 'no_cites', message: 'The effect has no recorded leaf citation.' }]
    : [];
}
function nodeGaps(
  node: ModelEntity,
  lookup: Lookup,
  records: readonly ModelEdge[],
): readonly ModelGap[] {
  const gaps: ModelGap[] = [...missingDetail(node, lookup, records), ...uncitedEffect(node)];
  const add = (kind: string, message: string): void => {
    gaps.push({ id: node.id, kind, message });
  };
  if (['store', 'topic'].includes(node.kind) && resourceOwnerOf(node.id, lookup) === null) {
    add('no_owner', 'No cited resource owner is recorded.');
  }
  if (
    node.kind === 'job' &&
    !['every', 'cron', 'trigger'].some((key) => typeof node.data[key] === 'string')
  ) {
    add('no_schedule', 'No schedule or trigger is recorded.');
  }
  if (node.kind === 'field' && node.data.type === undefined && node.data.ref === undefined) {
    add('no_schema', 'No field type is recorded.');
  }
  if (node.kind === 'message' && node.data.payload === undefined) {
    add('no_schema', 'No message payload schema is recorded.');
  }
  return gaps;
}
function isConnectionBacking(
  id: unknown,
  from: string,
  to: string | null,
  lookup: Lookup,
  records: readonly ModelEdge[],
): boolean {
  return records.some(
    (record) =>
      (record.site === id || record.handler === id) &&
      lookup.get(record.from)?.place.system === from &&
      lookup.get(record.to)?.place.system === to,
  );
}
function systemConnectionGaps(
  node: ModelEntity,
  lookup: Lookup,
  records: readonly ModelEdge[],
): readonly ModelGap[] {
  return modelList(node.data.connections).flatMap((value) => {
    const connection = modelRecord(value);
    const backs = modelList(connection?.backs);
    const to = modelText(connection?.to);
    const backed = backs.some((id) => isConnectionBacking(id, node.id, to, lookup, records));
    return backed
      ? []
      : [
          {
            id: node.id,
            kind: 'unbacked_connection',
            message: 'The stated connection has no recorded execution backing.',
            ...(to === null ? {} : { reference: to }),
          },
        ];
  });
}
function connectionGaps(lookup: Lookup, records: readonly ModelEdge[]): readonly ModelGap[] {
  return lookup.nodes
    .filter((node) => node.kind === 'system')
    .flatMap((node) => systemConnectionGaps(node, lookup, records));
}
function relatedGaps(
  id: string | undefined,
  lookup: Lookup,
  problems: readonly ModelGap[],
): readonly ModelGap[] {
  if (id === undefined) return problems;
  const root = lookup.get(id);
  if (root === null) return problems.filter((gap) => gap.id === id);
  return problems.filter((gap) => {
    let node = lookup.get(gap.id);
    while (node !== null) {
      if (node.id === root.id) return true;
      node = node.parent === null ? null : lookup.get(node.parent);
    }
    return gap.id === id;
  });
}
function flowOf(
  entry: string,
  lookup: Lookup,
  records: readonly ModelEdge[],
  problems: readonly ModelGap[],
): EntryFlow | null {
  const node = lookup.get(entry);
  if (node === null || !ENTRIES.has(node.kind)) return null;
  const handlers = handlersIn(lookup.model).filter(
    (handler) => canonicalId(handler.on, lookup) === node.id,
  );
  const ids = new Set(handlers.map((handler) => handler.id));
  return {
    entry: node,
    handlers,
    callers: incoming(node, lookup, records),
    reaches: records.filter((record) => record.handler !== null && ids.has(record.handler)),
    gaps: [
      ...relatedGaps(node.id, lookup, problems),
      ...handlers.flatMap((handler) => relatedGaps(handler.id, lookup, problems)),
    ],
  };
}
function freshnessOf(id: string, lookup: Lookup): ReturnType<ModelIndex['freshness']> {
  const repos = new Set(homesFor(id, lookup).map((home) => home.repo));
  for (const cite of lookup.cites(id)) if (cite.kind === 'code') repos.add(cite.repo);
  return lookup.model.evidence
    .filter((record) => repos.has(record.repository.repo))
    .map((record) => record.repository);
}
/** Build queries from serialisable data; ownership never supplies placement. */
export function indexOf(model: WorkspaceModel): ModelIndex {
  const lookup = createLookup(model);
  const problems: ModelGap[] = [...model.problems];
  const report = (problem: ModelGap): void => {
    problems.push(problem);
  };
  const detail = [
    ...stepEdges(lookup, report),
    ...subscriptionEdges(lookup, report),
    ...operationEdges(lookup),
  ];
  const records = [...detail, ...relationEdges(lookup, detail)];
  problems.push(
    ...lookup.nodes.flatMap((node) => nodeGaps(node, lookup, records)),
    ...connectionGaps(lookup, records),
    ...compositionGaps(lookup),
  );
  const projected = systemEdges(records, lookup);
  return {
    model,
    entities: lookup.nodes,
    get: lookup.get,
    cites: lookup.cites,
    label: (id) => labelOf(id, lookup),
    href: (id) => hrefOf(id, lookup),
    place: (id) => lookup.get(id)?.place ?? null,
    owningTeam: (id) => teamOf(id, lookup),
    resourceOwner: (id) => resourceOwnerOf(id, lookup),
    codeHomes: (id) => homesFor(id, lookup),
    edges: (id, options = {}) =>
      chooseEdges(
        options.level === 'system' ? projected : records,
        id === undefined ? undefined : (lookup.get(id)?.id ?? id),
        options,
      ),
    callers: (entry) => callersOf(entry, lookup, records),
    entries: (component) =>
      lookup.nodes.filter(
        (node) =>
          ENTRIES.has(node.kind) &&
          (component === undefined ||
            node.place.component === (lookup.get(component)?.id ?? component)),
      ),
    roles: (component) => rolesOf(lookup.get(component)?.id ?? component, lookup),
    producers: (message) => [
      ...new Set(
        records
          .filter(
            (record) =>
              record.kind === 'publish' && record.via === (lookup.get(message)?.id ?? message),
          )
          .map((record) => record.from),
      ),
    ],
    consumers: (message) => [
      ...new Set(
        records
          .filter(
            (record) =>
              record.kind === 'consume' && record.via === (lookup.get(message)?.id ?? message),
          )
          .map((record) => record.to),
      ),
    ],
    storeAccess: (store) =>
      records.filter(
        (record) =>
          record.to === (lookup.get(store)?.id ?? store) &&
          (record.kind === 'read' || record.kind === 'write'),
      ),
    fieldsReached: (operation) => {
      const node = lookup.get(operation);
      return node?.kind === 'operation' ? graphqlReaches(node, lookup) : [];
    },
    freshness: (id) => freshnessOf(id, lookup),
    flowOf: (entry) => flowOf(entry, lookup, records, problems),
    gaps: (id) => relatedGaps(id, lookup, problems),
  };
}
