import { forceLink, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force'

export const nodeWidth = 220
export const nodeHeight = 62

export interface ForceNode extends SimulationNodeDatum {
  id: string
  seedX: number
  seedY: number
}

export function pinNode(node: ForceNode, position: { x: number; y: number }) {
  // Update the physics position immediately; fx/fy alone wait until the next tick.
  node.x = node.fx = position.x + nodeWidth / 2
  node.y = node.fy = position.y + nodeHeight / 2
  node.vx = node.vy = 0
}

export function createMapSimulation(nodes: ForceNode[], relationships: { from: string; to: string }[]) {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const links = relationships.map(({ from, to }) => {
    const source = byId.get(from)!
    const target = byId.get(to)!
    return { source, target, distance: Math.hypot(target.seedX - source.seedX, target.seedY - source.seedY) }
  })
  return forceSimulation(nodes)
    .stop()
    // Keep the layered layout at rest; dragging should move neighbors, not collapse the tree.
    .force('links', forceLink<ForceNode, typeof links[number]>(links).distance(link => link.distance).strength(.3))
    .force('horizontal-shape', forceX<ForceNode>(node => node.seedX).strength(.025))
    .force('vertical-shape', forceY<ForceNode>(node => node.seedY).strength(.025))
    .force('collision', () => {
      // Cards are wide rectangles. Circular collisions pushed entire rows apart on pickup.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = b.x! + b.vx! - a.x! - a.vx!
          const dy = b.y! + b.vy! - a.y! - a.vy!
          const overlapX = nodeWidth + 24 - Math.abs(dx)
          const overlapY = nodeHeight + 24 - Math.abs(dy)
          if (overlapX <= 0 || overlapY <= 0) continue
          const aFree = a.fx == null, bFree = b.fx == null
          const free = Number(aFree) + Number(bFree)
          if (!free) continue
          if (overlapX < overlapY) {
            const push = Math.sign(dx || 1) * overlapX * .7 / free
            if (aFree) a.vx! -= push
            if (bFree) b.vx! += push
          } else {
            const push = Math.sign(dy || 1) * overlapY * .7 / free
            if (aFree) a.vy! -= push
            if (bFree) b.vy! += push
          }
        }
      }
    })
    .alpha(0)
    .alphaDecay(.035)
    .velocityDecay(.4)
}
