import type { ELK, ElkNode } from 'elkjs/lib/elk-api'

/**
 * One lazily loaded ELK instance for the whole viewer. The bundled build runs on the main thread, which is fine
 * for a local tool. A failed chunk load clears the cache so a retry fetches it again.
 */
let elk: Promise<ELK> | undefined
export function loadElk(): Promise<ELK> {
  elk ??= import('elkjs/lib/elk.bundled.js')
    .then(({ default: ElkConstructor }) => new ElkConstructor())
    .catch(error => {
      elk = undefined
      throw error
    })
  return elk
}

export async function layoutGraph(graph: ElkNode): Promise<ElkNode> {
  return (await loadElk()).layout(graph)
}

export type EdgeRoute = { path: string; labelX: number; labelY: number }
/** SVG paths and label centres for the laid-out edges that have both a route and a positioned label. */
export function edgeRoutes(layout: ElkNode): Record<string, EdgeRoute> {
  return Object.fromEntries((layout.edges ?? []).flatMap(edge => {
    const section = edge.sections?.[0]
    const label = edge.labels?.[0]
    if (!section || label?.x === undefined || label.y === undefined) return []
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
    const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
    return [[edge.id, { path, labelX: label.x + (label.width ?? 0) / 2, labelY: label.y + (label.height ?? 0) / 2 }]]
  }))
}
