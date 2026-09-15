import type { ElkNode } from 'elkjs/lib/elk-api'
import type { Component } from '../data/model.ts'
import { nodeWidth, nodeHeight } from './system-map-physics.ts'

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
  while (seen.size < components.length || cursor < queue.length) {
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
      'elk.spacing.nodeNode': '80',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '80',
      'elk.padding': '[top=30,left=30,bottom=30,right=30]',
    },
    children: visitOrder.map(id => ({ id, width: nodeWidth, height: nodeHeight })),
    edges: visitOrder.flatMap(from => children.get(from)!.map(to => ({
      id: JSON.stringify([from, to]), sources: [from], targets: [to],
    }))),
  }
}
