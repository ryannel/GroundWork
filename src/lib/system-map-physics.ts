import { forceLink, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force'

export const nodeWidth = 220
export const nodeHeight = 62

/** Pull along each relationship towards its laid-out length; keeps the tree shape while a neighbour is dragged. */
const LINK_STRENGTH = .3
/** Weak pull of every card back to its ELK position, so the map returns to the layout at rest. */
const SEED_PULL = .025
/** Minimum clear space between two cards, in pixels. */
const CARD_GAP = 24
/** Share of the overlap corrected per tick; below 1 so separation eases in instead of jumping. */
const OVERLAP_PUSH = .7
/** How quickly the simulation cools; ~160 ticks from a release alpha down to d3's 0.001 stop threshold. */
const ALPHA_DECAY = .035
/** Velocity damping per tick (d3's friction). */
const VELOCITY_DECAY = .4

/** Energy injected when cards are released, so neighbours glide back into the layout. */
export const RELEASE_ALPHA = .55
/** Energy on picking up a card, and the level held while it is dragged so neighbours keep responding. */
export const DRAG_ALPHA = .35
export const DRAG_ALPHA_TARGET = .25

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
  const links = relationships.flatMap(({ from, to }) => {
    const source = byId.get(from)
    const target = byId.get(to)
    if (!source || !target) return []
    return [{ source, target, distance: Math.hypot(target.seedX - source.seedX, target.seedY - source.seedY) }]
  })
  return forceSimulation(nodes)
    .stop()
    // Keep the layered layout at rest; dragging should move neighbors, not collapse the tree.
    .force('links', forceLink<ForceNode, typeof links[number]>(links).distance(link => link.distance).strength(LINK_STRENGTH))
    .force('horizontal-shape', forceX<ForceNode>(node => node.seedX).strength(SEED_PULL))
    .force('vertical-shape', forceY<ForceNode>(node => node.seedY).strength(SEED_PULL))
    .force('collision', () => {
      // Cards are wide rectangles. Circular collisions pushed entire rows apart on pickup.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = b.x! + b.vx! - a.x! - a.vx!
          const dy = b.y! + b.vy! - a.y! - a.vy!
          const overlapX = nodeWidth + CARD_GAP - Math.abs(dx)
          const overlapY = nodeHeight + CARD_GAP - Math.abs(dy)
          if (overlapX <= 0 || overlapY <= 0) continue
          const aFree = a.fx == null, bFree = b.fx == null
          const free = Number(aFree) + Number(bFree)
          if (!free) continue
          if (overlapX < overlapY) {
            const push = Math.sign(dx || 1) * overlapX * OVERLAP_PUSH / free
            if (aFree) a.vx! -= push
            if (bFree) b.vx! += push
          } else {
            const push = Math.sign(dy || 1) * overlapY * OVERLAP_PUSH / free
            if (aFree) a.vy! -= push
            if (bFree) b.vy! += push
          }
        }
      }
    })
    .alpha(0)
    .alphaDecay(ALPHA_DECAY)
    .velocityDecay(VELOCITY_DECAY)
}
