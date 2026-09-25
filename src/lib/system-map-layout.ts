import type { ElkNode } from 'elkjs/lib/elk-api'
import type { Component } from '../../shared/model.ts'
export const nodeWidth = 220
export const nodeHeight = 62

/** Space between neighbouring cards and between disconnected islands, in pixels. */
const NODE_SPACING = 80
const MAP_PADDING = 30
/** Columns in the grid used when the ELK layout cannot load or fails. */
const FALLBACK_COLUMNS = 4

/** Dash-safe relationship identity; `${from}-${to}` collides for ids such as `a-b`→`c` and `a`→`b-c`. */
export const relationshipId = (from: string, to: string) => JSON.stringify([from, to])

/**
 * Everything the placement depends on (ids, names and order of cards, and their relationships), so a new
 * layout runs when the structure changes and never when only an array's identity or node styling does.
 */
export function layoutSignature(components: Pick<Component, 'id' | 'name' | 'order'>[], relationships: { from: string; to: string }[]) {
  return JSON.stringify([components.map(({ id, name, order }) => [id, name, order]), relationships.map(({ from, to }) => [from, to])])
}

/** Top-left positions on a plain grid, used when ELK is unavailable. */
export function fallbackGridPositions(ids: string[], columns = FALLBACK_COLUMNS) {
  return new Map(ids.map((id, index) => [id, {
    x: MAP_PADDING + (index % columns) * (nodeWidth + NODE_SPACING),
    y: MAP_PADDING + Math.floor(index / columns) * (nodeHeight + NODE_SPACING),
  }]))
}

export type PortSide = 'left' | 'right' | 'top' | 'bottom'
const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const satisfies Record<PortSide, PortSide>
/** The side of the source card that faces the target, by the dominant axis between card centres. */
export function portSide(source: { x: number; y: number }, target: { x: number; y: number }): PortSide {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}
export const edgeHandles = (side: PortSide) => ({ sourceHandle: `source-${side}`, targetHandle: `target-${opposite[side]}` })

/** "2 in · 1 out" for message relationships; undefined for plain dependencies. */
export function messageEdgeLabel(messages?: { inbound: number; outbound: number }) {
  if (!messages) return undefined
  return [messages.inbound && `${messages.inbound} in`, messages.outbound && `${messages.outbound} out`].filter(Boolean).join(' · ')
}

/** A spanning forest controls placement only; the viewer still draws every relationship. */
export function systemMapLayout(components: Component[], relationships: { from: string; to: string }[]): ElkNode {
  const byId = new Map(components.map(component => [component.id, component]))
  const outgoing = new Map(components.map(component => [component.id, new Set<string>()]))
  const incoming = new Set<string>()
  for (const { from, to } of relationships) {
    if (from === to || !byId.has(from) || !byId.has(to)) continue
    outgoing.get(from)!.add(to)
    incoming.add(to)
  }
  const compare = (a: string, b: string) => byId.get(a)!.name.localeCompare(byId.get(b)!.name) || a.localeCompare(b)
  const ordered = [...byId.keys()].sort((a, b) => (byId.get(a)!.order ?? 0) - (byId.get(b)!.order ?? 0) || compare(a, b))
  const roots = ordered.filter(id => !incoming.has(id))
  const seen = new Set(roots)
  const children = new Map(ordered.map(id => [id, [] as string[]]))
  const queue = [...roots]
  let cursor = 0
  while (seen.size < byId.size || cursor < queue.length) {
    if (cursor === queue.length) {
      // A disconnected cycle has no entry node. Pick a stable root for that island.
      const root = ordered.find(id => !seen.has(id))!
      roots.push(root)
      seen.add(root)
      queue.push(root)
    }
    const id = queue[cursor++]
    for (const target of [...outgoing.get(id)!].sort(compare)) {
      if (seen.has(target)) continue
      seen.add(target)
      children.get(id)!.push(target)
      queue.push(target)
    }
  }

  // Put the longest continuing branch in the middle, with resources to either side.
  // Breadth-first ownership keeps shared storage beside its earliest caller.
  const heights = new Map<string, number>()
  for (const id of [...queue].reverse()) {
    const siblings = children.get(id)!
    siblings.sort(compare)
    const main = [...siblings].sort((a, b) => heights.get(b)! - heights.get(a)! || compare(a, b))[0]
    if (main && heights.get(main)! > 0) {
      siblings.splice(siblings.indexOf(main), 1)
      siblings.splice(Math.floor((siblings.length + 1) / 2), 0, main)
    }
    heights.set(id, 1 + Math.max(-1, ...siblings.map(child => heights.get(child)!)))
  }
  const visitOrder: string[] = []
  const stack = [...roots].reverse()
  while (stack.length) {
    const id = stack.pop()!
    visitOrder.push(id)
    stack.push(...[...children.get(id)!].reverse())
  }

  return {
    id: 'system',
    layoutOptions: {
      'elk.algorithm': 'mrtree',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': String(NODE_SPACING),
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': String(NODE_SPACING),
      'elk.padding': `[top=${MAP_PADDING},left=${MAP_PADDING},bottom=${MAP_PADDING},right=${MAP_PADDING}]`,
    },
    children: visitOrder.map(id => ({ id, width: nodeWidth, height: nodeHeight })),
    edges: visitOrder.flatMap(from => children.get(from)!.map(to => ({
      id: relationshipId(from, to), sources: [from], targets: [to],
    }))),
  }
}
