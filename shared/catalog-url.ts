import type { CatalogKind } from './catalog-identity.ts'

/**
 * The component inspector's URL contract, shared by the viewer and the server's catalog deep links.
 * Pure: no React, no router. Every catalog query parameter is named here and nowhere else.
 */
export const catalogBrowsers = ['api', 'data', 'messages', 'jobs'] as const
export type CatalogBrowserKey = typeof catalogBrowsers[number]
export const catalogTabs = ['overview', ...catalogBrowsers] as const
export type CatalogTab = typeof catalogTabs[number]
type BrowserField = 'Entity' | 'Query' | 'Group'

/** Component-scoped parameters. `component` itself is the product page's selection and is not listed. */
export const CATALOG_PARAMS = [
  'catalog',
  'apiEntity', 'apiQuery', 'apiGroup', 'apiView', 'apiMethod', 'apiVersion',
  'dataEntity', 'dataQuery', 'dataGroup',
  'messagesEntity', 'messagesQuery', 'messagesGroup', 'messagesDirection',
  'jobsEntity', 'jobsQuery', 'jobsGroup',
  'schema', 'flow', 'from',
] as const
export type CatalogParam = typeof CATALOG_PARAMS[number]
type Expect<T extends true> = T
/** Compile-time check that every browser parameter is listed above. */
export type BrowserParamsListed = Expect<`${CatalogBrowserKey}${BrowserField}` extends CatalogParam ? true : false>
/** Keys are parameter names; an empty or missing value means the parameter is absent. */
export type CatalogLocation = Partial<Record<CatalogParam, string>>
export type CatalogHistory = 'push' | 'replace'

export const browserParam = <F extends BrowserField>(browser: CatalogBrowserKey, field: F) => `${browser}${field}` as `${CatalogBrowserKey}${F}`

/** Filters owned by one browser; they are cleared when a flow link focuses an entity that they might hide. */
export const browserFilterParams: Record<CatalogBrowserKey, readonly CatalogParam[]> = {
  api: ['apiMethod', 'apiVersion'],
  data: [],
  messages: ['messagesDirection'],
  jobs: [],
}

const entityParams = {
  component: 'component',
  endpoint: 'apiEntity',
  schema: 'schema',
  data: 'dataEntity',
  message: 'messagesEntity',
  job: 'jobsEntity',
  flow: 'flow',
} as const satisfies Record<CatalogKind, CatalogParam | 'component'>

/** The parameter that addresses one entity of a catalog kind. */
export const entityParam = <K extends CatalogKind>(kind: K): typeof entityParams[K] => entityParams[kind]

export function readCatalogLocation(params: URLSearchParams): CatalogLocation {
  const location: CatalogLocation = {}
  for (const key of CATALOG_PARAMS) {
    const value = params.get(key)
    if (value) location[key] = value
  }
  return location
}

/** Returns a copy with the patch applied; `undefined` or `''` removes a parameter. */
export function writeCatalogLocation(params: URLSearchParams, patch: CatalogLocation): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

const navigationParams = new Set<string>(['apiEntity', 'dataEntity', 'messagesEntity', 'jobsEntity', 'schema', 'flow'])
/**
 * Selecting an entity or following a link is navigation and gets a history entry. Tabs, views, searches and
 * filters replace the current entry, so Back leaves the page instead of replaying keyboard focus moves.
 */
export function catalogHistory(patch: CatalogLocation): CatalogHistory {
  return Object.entries(patch).some(([key, value]) => value && navigationParams.has(key)) ? 'push' : 'replace'
}

/** Drops every component-scoped parameter so a newly selected component starts clean. */
export function clearComponentScope(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of CATALOG_PARAMS) next.delete(key)
  return next
}

/** Opens a browser on one entity, clearing the search and filters that could hide it. */
export function focusEntity(browser: CatalogBrowserKey, id: string): CatalogLocation {
  const patch: CatalogLocation = {
    catalog: browser,
    [browserParam(browser, 'Entity')]: id,
    [browserParam(browser, 'Query')]: undefined,
    [browserParam(browser, 'Group')]: undefined,
  }
  for (const key of browserFilterParams[browser]) patch[key] = undefined
  return patch
}

export type CatalogTarget =
  | { kind: Exclude<CatalogKind, 'flow'>; id: string }
  | { kind: 'flow'; id: string; endpointId?: string; trigger?: { kind: 'message'; messageId: string } | { kind: 'job'; jobId: string } }

/** Deep link for one catalog entity inside its component (the server adds `component`). */
export function catalogLocationFor(target: CatalogTarget): CatalogLocation {
  switch (target.kind) {
    case 'component': return {}
    case 'schema': return { catalog: 'api', schema: target.id }
    case 'endpoint': return { catalog: 'api', apiEntity: target.id }
    case 'data': return { catalog: 'data', dataEntity: target.id }
    case 'message': return { catalog: 'messages', messagesEntity: target.id }
    case 'job': return { catalog: 'jobs', jobsEntity: target.id }
    case 'flow': {
      const { trigger } = target
      if (trigger?.kind === 'message') return { catalog: 'messages', messagesEntity: trigger.messageId, flow: target.id }
      if (trigger?.kind === 'job') return { catalog: 'jobs', jobsEntity: trigger.jobId, flow: target.id }
      return { catalog: 'api', apiEntity: target.endpointId, apiView: 'flow', flow: target.id }
    }
  }
}

/** The entity a location points at, most specific first; the inverse of `catalogLocationFor`. */
export function catalogTargetOf(location: CatalogLocation): { kind: CatalogKind; id: string } | undefined {
  if (location.schema) return { kind: 'schema', id: location.schema }
  if (location.flow) return { kind: 'flow', id: location.flow }
  const tab = location.catalog
  if (tab === 'api' && location.apiEntity) return { kind: 'endpoint', id: location.apiEntity }
  if (tab === 'data' && location.dataEntity) return { kind: 'data', id: location.dataEntity }
  if (tab === 'messages' && location.messagesEntity) return { kind: 'message', id: location.messagesEntity }
  if (tab === 'jobs' && location.jobsEntity) return { kind: 'job', id: location.jobsEntity }
  return undefined
}
