import type { Component } from './model.ts'

type Api = NonNullable<Component['api']>
export type CatalogEntry = { id: string; name: string; group: string; detail: string; search: string; badge?: string; annotation?: string }

export function catalogVersions(api: Api) {
  const versions = new Map((api.versions ?? []).map(version => [version.id, version.label]))
  if (api.version && !versions.has(api.version)) versions.set(api.version, api.version)
  for (const endpoint of api.endpoints) if (endpoint.version && !versions.has(endpoint.version)) versions.set(endpoint.version, endpoint.version)
  return [...versions].map(([id, label]) => ({ id, label }))
}

/** Group by the first resource segment, never infer business domains or relationships. */
export function endpointGroup(endpoint: Api['endpoints'][number]) {
  if (endpoint.method === 'EVENT') return 'Event contracts'
  const segments = endpoint.path.split('/').filter(Boolean)
  if (segments[0]?.toLowerCase() === 'api') segments.shift()
  if (/^v\d+(?:\.\d+)?$/i.test(segments[0] ?? '')) segments.shift()
  return segments[0] && !segments[0].startsWith('{') ? segments[0] : 'Other interfaces'
}

export function filterCatalog(entries: CatalogEntry[], query: string, group = 'all') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(entry => (group === 'all' || entry.group === group) && terms.every(term => `${entry.name} ${entry.group} ${entry.detail} ${entry.search}`.toLocaleLowerCase().includes(term)))
}

export function catalogSelection(entries: CatalogEntry[], selectedId: string) {
  return entries.find(entry => entry.id === selectedId) ?? entries[0]
}
