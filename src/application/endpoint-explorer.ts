import { permalinkOf } from '@/domain/code-links';
import { childPathOf, kindOf, rootId } from '@/domain/ids';
import { modelList, modelRecord, modelText, type ModelEntity } from '@/domain/workspace-model';

import { entryFlowOf, type FlowNode } from './entry-flow';
import { entryFlowHref } from './entry-flow-paths';
import type { ModelIndex } from './model-index';

export interface EndpointField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly key: boolean;
  readonly note: string | null;
  readonly ref: string | null;
}

export interface EndpointSchema {
  readonly id: string;
  readonly name: string;
  readonly summary: string | null;
  readonly fields: readonly EndpointField[];
}

export interface EndpointTable extends EndpointSchema {
  readonly access: readonly ('read' | 'write')[];
  /** Fields a step names directly, such as `sch:cart#owner`. */
  readonly touched: readonly string[];
}

export interface EndpointStore {
  readonly id: string;
  readonly name: string;
  readonly form: string | null;
  readonly technology: string | null;
  readonly summary: string | null;
  readonly tables: readonly EndpointTable[];
  /** The store's other recorded tables, by name, which this endpoint does not touch. */
  readonly others: readonly string[];
}

interface Link {
  readonly label: string;
  readonly href: string;
}

interface Named {
  readonly id: string;
  readonly name: string;
}

/** A handler step as the inspector draws it: what it does, when, and the steps under it. */
export interface EndpointStep {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly condition: string | null;
  readonly async: boolean;
  readonly branches: readonly { readonly label: string; readonly nodes: readonly EndpointStep[] }[];
}

export interface EndpointHandler {
  readonly id: string;
  readonly summary: string | null;
  readonly nodes: readonly EndpointStep[];
  readonly failures: readonly EndpointStep[];
}

/** Everything the inspector shows for one endpoint, projected once on the server from the model. */
export interface EndpointExplorerView {
  readonly id: string;
  readonly signature: string;
  readonly summary: string | null;
  readonly auth: string | null;
  readonly idempotent: boolean | null;
  readonly component: Named | null;
  readonly system: Named | null;
  readonly team: string | null;
  /** The other endpoints the same component serves, in recorded order. */
  readonly operations: readonly Named[];
  readonly params: { readonly path: readonly string[]; readonly query: readonly string[] };
  readonly request: EndpointSchema | null;
  readonly response: EndpointSchema | null;
  readonly errors: readonly { readonly status: string; readonly when: string }[];
  readonly callers: readonly Named[];
  readonly calls: readonly Named[];
  readonly messages: readonly (Named & { readonly direction: 'publish' })[];
  readonly stores: readonly EndpointStore[];
  readonly handlers: readonly EndpointHandler[];
  readonly sources: readonly Link[];
  readonly logicHref: string;
}

function typeText(value: unknown): string {
  if (typeof value === 'string') return value;
  const data = modelRecord(value);
  const options = modelList(data?.enum);
  if (options.length > 0) return options.map(String).join(' | ');
  return value === undefined ? 'unknown' : JSON.stringify(value);
}

function schemaOf(index: ModelIndex, id: string | null): EndpointSchema | null {
  if (id === null) return null;
  const schema = index.get(rootId(id));
  if (schema?.kind !== 'schema') return null;
  return {
    id: schema.id,
    name: index.label(schema.id),
    summary: modelText(schema.data.summary),
    fields: modelList(schema.data.fields).flatMap((item) => {
      const field = modelRecord(item);
      const name = modelText(field?.name);
      if (field === null || name === null) return [];
      return [
        {
          name,
          type: typeText(field.type),
          required: field.required === true,
          key: field.key === true,
          note: modelText(field.note),
          ref: modelText(field.ref),
        },
      ];
    }),
  };
}

function paramsOf(signature: string): EndpointExplorerView['params'] {
  const [route = '', search = ''] = (signature.split(/\s+/u).at(-1) ?? '').split('?');
  return {
    path: route
      .split('/')
      .filter((part) => part.startsWith('{') && part.endsWith('}'))
      .map((part) => part.slice(1, -1)),
    query: search === '' ? [] : search.split('&').map((part) => part.split('=')[0] ?? part),
  };
}

interface Access {
  readonly store: string;
  readonly schema: string;
  readonly field: string | null;
  readonly mode: 'read' | 'write';
}

/** Every read and write anywhere in the handler steps, however deeply nested. */
function accessesIn(value: unknown): readonly Access[] {
  if (Array.isArray(value)) return value.flatMap(accessesIn);
  const data = modelRecord(value);
  if (data === null) return [];
  const own = (['read', 'write'] as const).flatMap((mode) => {
    const target = modelText(data[mode]);
    const store = modelText(data[mode === 'read' ? 'from' : 'to']);
    if (target === null || store === null) return [];
    return [{ store, schema: rootId(target), field: childPathOf(target) ?? null, mode }];
  });
  return [
    ...own,
    ...Object.entries(data).flatMap(([key, child]) => (key === 'cites' ? [] : accessesIn(child))),
  ];
}

function tablesOf(index: ModelIndex, uses: readonly Access[]): readonly EndpointTable[] {
  return [...Map.groupBy(uses, (use) => use.schema)].flatMap(([schema, touches]) => {
    const shape = schemaOf(index, schema);
    if (shape === null) return [];
    const modes = new Set(touches.map((touch) => touch.mode));
    return [
      {
        ...shape,
        access: (['read', 'write'] as const).filter((mode) => modes.has(mode)),
        touched: [...new Set(touches.flatMap((touch) => touch.field ?? []))],
      },
    ];
  });
}

function storesOf(index: ModelIndex, handlers: readonly ModelEntity[]): readonly EndpointStore[] {
  const accesses = handlers.flatMap((handler) => accessesIn(handler.data.steps));
  return [...Map.groupBy(accesses, (access) => access.store)].map(([id, uses]) => {
    const store = index.get(id);
    const tables = tablesOf(index, uses);
    const used = new Set(tables.map((table) => table.id));
    const others = index.entities
      .filter(
        (entity) => entity.kind === 'schema' && entity.data.store === id && !used.has(entity.id),
      )
      .map((entity) => index.label(entity.id));
    return {
      id,
      name: index.label(id),
      form: modelText(store?.data.form),
      technology: modelText(store?.data.tech),
      summary: modelText(store?.data.does),
      tables,
      others,
    };
  });
}

function stepOf(node: FlowNode): EndpointStep {
  return {
    id: node.id,
    title: node.title,
    kind: node.kind,
    condition: node.condition,
    async: node.async,
    branches: node.branches.map((branch) => ({
      label: branch.label,
      nodes: branch.nodes.map(stepOf),
    })),
  };
}

function named(index: ModelIndex, id: string | null): Named | null {
  return id === null ? null : { id, name: index.label(id) };
}

function uniqueNamed(index: ModelIndex, ids: readonly string[]): readonly Named[] {
  return [...new Set(ids)].map((id) => ({ id, name: index.label(id) }));
}

function operationsOf(index: ModelIndex, component: string | null): readonly Named[] {
  if (component === null) return [];
  return index
    .entries(component)
    .filter((entry) => entry.kind === 'endpoint')
    .map((entry) => ({ id: entry.id, name: modelText(entry.data.sig) ?? index.label(entry.id) }));
}

function errorsOf(endpoint: ModelEntity): EndpointExplorerView['errors'] {
  return modelList(endpoint.data.errors).flatMap((item) => {
    const error = modelRecord(item);
    const status = error?.status;
    if (typeof status !== 'string' && typeof status !== 'number') return [];
    return [{ status: String(status), when: modelText(error?.when) ?? 'No condition recorded' }];
  });
}

function reachOf(
  index: ModelIndex,
  id: string,
): Pick<EndpointExplorerView, 'callers' | 'calls' | 'messages'> {
  const flow = index.flowOf(id);
  const reaching = (kind: string): readonly Named[] =>
    uniqueNamed(
      index,
      (flow?.reaches ?? []).filter((edge) => edge.kind === kind).map((edge) => edge.to),
    );
  return {
    callers: uniqueNamed(
      index,
      (flow?.callers ?? []).map((edge) => edge.from),
    ),
    calls: reaching('call'),
    messages: reaching('publish').map((message) => ({ ...message, direction: 'publish' as const })),
  };
}

export function endpointExplorerOf(index: ModelIndex, id: string): EndpointExplorerView | null {
  const endpoint = index.get(id);
  if (endpoint === null || kindOf(id) !== 'endpoint') return null;
  const view = entryFlowOf(index, id);
  const signature = modelText(endpoint.data.sig) ?? index.label(id);
  const handlerIds = new Set((view?.handlers ?? []).map((handler) => handler.id));
  const handlers = index.entities.filter((entity) => handlerIds.has(entity.id));
  const team = index.owningTeam(id);
  return {
    id,
    signature,
    summary: modelText(endpoint.data.summary),
    auth: modelText(endpoint.data.auth),
    idempotent: typeof endpoint.data.idempotent === 'boolean' ? endpoint.data.idempotent : null,
    component: named(index, endpoint.place.component),
    system: named(index, endpoint.place.system),
    team: team === null ? null : index.label(team),
    operations: operationsOf(index, endpoint.place.component),
    params: paramsOf(signature),
    request: schemaOf(index, modelText(endpoint.data.request)),
    response: schemaOf(index, modelText(endpoint.data.response)),
    errors: errorsOf(endpoint),
    ...reachOf(index, id),
    stores: storesOf(index, handlers),
    handlers: (view?.handlers ?? []).map((handler) => ({
      id: handler.id,
      summary: handler.summary,
      nodes: handler.nodes.map(stepOf),
      failures: handler.failures.map(stepOf),
    })),
    sources: index.cites(id).flatMap((cite) =>
      cite.kind === 'code'
        ? [
            {
              label: cite.symbol ?? cite.path.split('/').at(-1) ?? cite.path,
              href: permalinkOf(cite),
            },
          ]
        : [],
    ),
    logicHref: entryFlowHref(index.model.id, { entry: id }),
  };
}
