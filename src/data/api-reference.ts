import type { ApiContract } from './spec.ts'

export type ContractKind = 'http' | 'messages' | 'other'
export const contractKind = (c: ApiContract): ContractKind => c.method === 'EVENT' ? 'messages' : c.method && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(c.method) ? 'http' : 'other'
const title = (value: string) => value.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/** Preserve the source verbatim; only recognize the import's explicit metadata markers. */
export function contractNotes(note = '') {
  const sourceAt = note.search(/(?:^|\s)Source: tdd\//)
  const source = sourceAt >= 0 ? note.slice(sourceAt).trim().replace(/^Source:\s*/, '') : undefined
  const body = sourceAt >= 0 ? note.slice(0, sourceAt).trim() : note
  const markers = [...body.matchAll(/(?:^|[;\s])(?:Auth|Idempotency|Echo suppression|Response|Query params|Errors|Side effects):\s*/g)]
  const description = (markers.length ? body.slice(0, markers[0].index) : body).trim()
  const facts = markers.map((match, i) => ({
    label: match[0].trim().replace(/^;\s*/, '').replace(/:\s*$/, ''),
    value: body.slice(match.index! + match[0].length, markers[i + 1]?.index ?? body.length).trim().replace(/;$/, ''),
  })).filter(f => f.value)
  return { description, facts, source }
}

export function contractResource(c: ApiContract): string {
  if (contractKind(c) === 'http') return title(c.path.split('?')[0].split('/').find(p => p && !/^v\d+$/.test(p)) ?? 'Root')
  const source = c.note?.match(/Source: tdd\/contracts\/([\w-]+)\.mdx/)
  if (source) return title(source[1])
  if (contractKind(c) === 'messages') {
    const parts = c.path.split('.')
    return parts.length > 2 ? title(parts.slice(0, -2).join(' · ')) : 'Messages'
  }
  return 'Other contracts'
}
const methodOrder = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'EVENT', 'RPC']
export function groupContracts(contracts: ApiContract[]) {
  const resources = new Map<string, Map<string, ApiContract[]>>()
  for (const c of contracts) {
    const resource = contractResource(c)
    const endpoints = resources.get(resource) ?? new Map<string, ApiContract[]>()
    const key = c.path
    endpoints.set(key, [...(endpoints.get(key) ?? []), c])
    resources.set(resource, endpoints)
  }
  return [...resources].sort(([a], [b]) => a.localeCompare(b)).map(([name, endpoints]) => ({ name,
    count: [...endpoints.values()].reduce((n, cs) => n + cs.length, 0),
    endpoints: [...endpoints].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([path, cs]) => ({ path,
      contracts: cs.sort((a, b) => methodOrder.indexOf(a.method ?? '') - methodOrder.indexOf(b.method ?? '') || a.from.localeCompare(b.from) || a.id.localeCompare(b.id)),
    })),
  }))
}

/** HTTP/RPC APIs are provided by the receiver; outgoing messages belong to the sender's published surface. */
export const apiProvider = (c: ApiContract) => contractKind(c) === 'messages' ? c.from : c.to
export function apiOperations(contracts: ApiContract[]) {
  const operations = new Map<string, ApiContract[]>()
  for (const c of contracts) {
    const key = JSON.stringify([apiProvider(c), c.method ?? '', c.path])
    operations.set(key, [...(operations.get(key) ?? []), c])
  }
  return [...operations].map(([key, records]) => ({ key, provider: apiProvider(records[0]), method: records[0].method, path: records[0].path, kind: contractKind(records[0]), records,
    change: records.every(c => c.change === records[0].change) ? records[0].change : 'mixed' as const,
  }))
}
