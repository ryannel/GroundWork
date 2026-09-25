import type { Component } from '../../shared/model.ts'
import { endpointGroup, type CatalogEntry } from './catalog-navigation.ts'
import { componentKind, componentKindLabel } from '../../shared/component-structure.ts'
import { browserParam, catalogBrowsers, focusEntity, type CatalogBrowserKey, type CatalogLocation, type CatalogTab } from '../../shared/catalog-url.ts'

/** Pure view logic for the component inspector; the React components only render what these return. */
export type ApiCatalog = NonNullable<Component['api']>
export type ApiEndpoint = ApiCatalog['endpoints'][number]
export type ApiType = NonNullable<ApiCatalog['schemas']>[number]
export type ApiField = ApiType['fields'][number]
export type ExecutionFlows = NonNullable<Component['executionFlows']>

/* Schemas: ids are unique, names are not (versioned APIs, namespaces), so a name resolves to every candidate. */
export interface SchemaIndex { byId: ReadonlyMap<string, ApiType>; byName: ReadonlyMap<string, readonly ApiType[]> }
export function schemaIndex(schemas: readonly ApiType[] = []): SchemaIndex {
  const byName = new Map<string, ApiType[]>()
  for (const schema of schemas) byName.set(schema.name, [...(byName.get(schema.name) ?? []), schema])
  return { byId: new Map(schemas.map(schema => [schema.id, schema])), byName }
}
export function referencedSchemas(type: string | undefined, index: SchemaIndex): ApiType[] {
  const names = new Set(type?.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])
  return [...names].flatMap(name => index.byName.get(name) ?? [])
}

/* Catalog browser entries, including the text each search matches. */
const fieldSearch = (fields: readonly ApiField[]) => fields.map(field => `${field.name} ${field.type} ${field.description ?? ''}`)
/** One entry per endpoint, in `api.endpoints` order. */
export function endpointEntries(component: Component, index: SchemaIndex): CatalogEntry[] {
  const traced = new Set((component.executionFlows ?? []).map(flow => flow.endpointId))
  return (component.api?.endpoints ?? []).map(endpoint => ({
    id: endpoint.id,
    name: endpoint.name,
    group: endpointGroup(endpoint),
    detail: endpoint.path,
    badge: endpoint.method,
    annotation: traced.has(endpoint.id) ? 'Data flow traced' : undefined,
    search: [
      endpoint.summary, endpoint.request, endpoint.response, endpoint.version, endpoint.source,
      ...[endpoint.request, endpoint.response].flatMap(type => referencedSchemas(type, index))
        .flatMap(schema => schema.fields.map(field => `${field.name} ${field.type}`)),
    ].join(' '),
  }))
}
export const endpointMatches = (endpoint: ApiEndpoint, method = 'all', version = 'all') =>
  (version === 'all' || endpoint.version === version) && (method === 'all' || endpoint.method === method)
export const recordEntries = (records: NonNullable<Component['data']>['records']): CatalogEntry[] => records.map(record => ({
  id: record.id, name: record.name, group: record.kind, detail: `${record.fields.length} fields`,
  search: [record.keyPattern, record.description, ...fieldSearch(record.fields)].join(' '),
}))
export const messageEntries = (messages: NonNullable<Component['messaging']>['messages']): CatalogEntry[] => messages.map(message => ({
  id: message.id, name: message.name, group: message.broker, badge: message.direction, detail: message.channel,
  search: fieldSearch(message.fields).join(' '),
}))
export const jobEntries = (jobs: NonNullable<Component['jobs']>): CatalogEntry[] => jobs.map(job => ({
  id: job.id, name: job.name, group: job.schedule ?? 'Schedule not documented', detail: job.description, search: job.source ?? '',
}))

/* Tabs */
export interface InspectorTab { id: CatalogTab; label: string; description: string; count: number | '—' | null }
export function inspectorTabs(component: Component): InspectorTab[] {
  return [
    { id: 'overview', label: 'Overview', description: 'Responsibility & scope', count: null },
    { id: 'api', label: 'Interfaces', description: 'Endpoints & payloads', count: component.api?.endpoints.length ?? 0 },
    { id: 'data', label: 'Data', description: 'Records & storage', count: component.data?.records.length ?? 0 },
    { id: 'messages', label: 'Messages', description: 'Channels & delivery', count: component.messaging?.messages.length ?? 0 },
    ...component.jobs?.length
      ? [{ id: 'jobs', label: 'Jobs', description: 'Background entry points', count: component.jobs.length } as const]
      : [],
  ]
}
export const activeTab = (tabs: readonly InspectorTab[], requested?: string): CatalogTab =>
  tabs.find(tab => tab.id === requested)?.id ?? 'overview'
export const tabAriaLabel = ({ label, count }: InspectorTab) =>
  count === null ? label : `${label}: ${count === '—' ? 'not yet established' : `${count} catalogued`}`

export const selectTab = (_component: Component, location: CatalogLocation, tab: CatalogTab): CatalogLocation =>
  ({ ...location, catalog: tab, from: undefined })

/* Execution flows and the "Back to …" breadcrumb, carried in the URL as `from=<tab>:<id>`. */
export const endpointFlows = (component: Component, endpointId: string) =>
  (component.executionFlows ?? []).filter(flow => flow.endpointId === endpointId)
export const triggeredFlows = (component: Component, kind: 'message' | 'job', id: string) =>
  (component.executionFlows ?? []).filter(flow => flow.trigger?.kind === kind
    && (flow.trigger.kind === 'message' ? flow.trigger.messageId : flow.trigger.jobId) === id)
export const selectedFlow = (flows: ExecutionFlows, id?: string) => flows.find(flow => flow.id === id) ?? flows[0]

export interface FlowOrigin { tab: CatalogBrowserKey; id: string; name: string; label: string }
export function flowOrigin(component: Component, from?: string): FlowOrigin | undefined {
  const split = from?.indexOf(':') ?? -1
  if (!from || split < 0) return undefined
  const tab = from.slice(0, split) as CatalogBrowserKey
  const id = from.slice(split + 1)
  if (!catalogBrowsers.includes(tab)) return undefined
  if (tab === 'api') {
    const endpoint = component.api?.endpoints.find(item => item.id === id)
    return endpoint && { tab, id, name: endpoint.name, label: `${endpoint.method} ${endpoint.path}` }
  }
  const named = tab === 'messages' ? component.messaging?.messages.find(item => item.id === id)
    : tab === 'jobs' ? component.jobs?.find(item => item.id === id) : undefined
  return named && { tab, id, name: named.name, label: named.name }
}
/** Follows a flow step's catalog link and remembers where it came from. */
export const followFlowLink = (target: { tab: 'data' | 'messages'; id: string }, origin: { tab: CatalogBrowserKey; id: string }): CatalogLocation =>
  ({ ...focusEntity(target.tab, target.id), from: `${origin.tab}:${origin.id}` })
export const returnToOrigin = (origin: FlowOrigin): CatalogLocation => ({
  catalog: origin.tab,
  [browserParam(origin.tab, 'Entity')]: origin.id,
  from: undefined,
  ...origin.tab === 'api' ? { apiView: 'flow' } : {},
})

/* Dependencies */
const datastoreKinds = new Set(['database', 'cache', 'object-storage', 'local-storage'])
export const isDatastore = (component: Component) => datastoreKinds.has(componentKind(component))
export const isBroker = (component: Component) => componentKind(component) === 'queue'
export function dependencyContextLabel(dependency: Component) {
  if (dependency.role === 'platform-service') return `${dependency.ownership === 'third-party' ? 'External' : 'Internal'} platform`
  if (dependency.role === 'external-provider') return 'External provider'
  if (dependency.ownership === 'third-party') return 'External service'
  if (dependency.kind === 'external-service') return 'Internal service'
  return componentKindLabel(dependency)
}

/* Narrative */
export function readableList(items: readonly string[]) {
  if (items.length < 2) return items[0] ?? ''
  if (items.length === 2) return items.join(' and ')
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}
/** Orientation sentences from catalog records only; never a claim about live runtime behaviour. */
export function mentalModel(component: Component, dependencies: readonly Component[]) {
  const apiMethods = new Set(component.api?.endpoints.map(endpoint => endpoint.method))
  const entryPoints = [
    [...apiMethods].some(method => !['EVENT', 'RPC'].includes(method)) && 'HTTP interfaces',
    apiMethods.has('RPC') && 'RPC interfaces',
    apiMethods.has('EVENT') && 'event interfaces',
    component.messaging?.messages.some(message => message.direction === 'inbound') && 'inbound messages',
    !!component.jobs?.length && 'background jobs',
  ].filter((entry): entry is string => !!entry)
  const outbound = component.messaging?.messages.some(message => message.direction === 'outbound') ?? false
  const access = component.data?.access
  const state = component.data?.technology
    ? `${access?.length ? `${readableList(access)} access to ` : ''}${component.data.technology}`
    : component.data?.records.length ? 'catalogued records' : ''
  const boundary = readableList(dependencies.slice(0, 4).map(dependency => dependency.name))
  const unresolved = component.unresolvedDependencies ?? []

  const enters = entryPoints.length
    ? `Treat ${readableList(entryPoints)} as the component's known entry points. `
      + 'Start in Interfaces, Messages, or Jobs when you need the exact contract.'
    : 'No entry point has been established yet. The absence of a catalogued interface does not prove this component has no runtime trigger.'
  const inside = state
    ? `The catalog shows ${state}. Use Data to understand the state this component reads or changes before following its external effects.`
    : 'No owned state has been established. Reason about this component primarily through its contracts and recorded execution paths.'
  const crossing = boundary ? `Mapped processing crosses into ${boundary}` : 'No component dependency is currently mapped'
  const leaves = boundary || outbound
    ? `${crossing}${outbound ? `${boundary ? ', and' : ', but'} the component also records outbound messages` : ''}. `
      + 'These are architectural boundaries; open a recorded path to see whether a particular call is synchronous or asynchronous.'
    : 'No outgoing component or message boundary is currently established. Check known limitations before treating this as an isolated component.'
  const blindSpots = unresolved.length
    ? `${readableList(unresolved.slice(0, 4).map(dependency => dependency.name))}${unresolved.length > 4 ? ` and ${unresolved.length - 4} more` : ''} `
      + `${unresolved.length === 1 ? 'is' : 'are'} referenced in source but not yet matched to a component. `
      + 'Check source citations and documented gaps before making boundary decisions.'
    : undefined
  return { enters, inside, leaves, blindSpots }
}

/** A missing area is unknown until its gap list was explicitly checked. */
export function emptyCatalogText(component: Component, area: 'api' | 'data' | 'messaging', label: string) {
  if (component.areaGaps?.[area]?.length === 0) {
    return { title: `No ${label} recorded`, body: `The checked catalog records no ${label} for ${component.name}.` }
  }
  return { title: `${label[0].toUpperCase() + label.slice(1)} not yet catalogued`,
    body: `Review the source and recorded gaps for ${component.name} before drawing conclusions about ${label}.` }
}

/** An endpoint's first evidence, or its declared source file at the catalog revision. */
export function endpointSource(component: Component, endpoint: ApiEndpoint) {
  return endpoint.evidence?.[0]
    ?? (endpoint.source && component.sourceRevision
      ? { path: endpoint.source, revision: component.sourceRevision, lines: '1', claim: '' }
      : undefined)
}
