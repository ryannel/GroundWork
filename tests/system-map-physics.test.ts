import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMapSimulation, pinNode, type ForceNode } from '../src/lib/system-map-physics.ts'

const node = (id: string, x: number, y: number): ForceNode => ({ id, x, y, seedX: x, seedY: y })

test('picking up a card does not collapse the layered layout or push adjacent rows apart', () => {
  const nodes = [node('app', 140, 100), node('ml', 140, 210), node('core', 470, 260)]
  const simulation = createMapSimulation(nodes, [{ from: 'app', to: 'core' }, { from: 'ml', to: 'core' }])
  pinNode(nodes[0], { x: 30, y: 69 })
  simulation.alpha(.35).tick(30)
  for (const n of nodes) {
    assert.ok(Math.abs(n.x! - n.seedX) < .01)
    assert.ok(Math.abs(n.y! - n.seedY) < .01)
  }
})

test('neighbors move during drag, while dropped cards remain pinned across later drags', () => {
  const nodes = [node('app', 140, 100), node('core', 470, 100), node('db', 800, 100)]
  const simulation = createMapSimulation(nodes, [{ from: 'app', to: 'core' }, { from: 'core', to: 'db' }])
  pinNode(nodes[0], { x: 30, y: 229 })
  simulation.alpha(.35).alphaTarget(.25)
  const samples: number[] = []
  for (let frame = 0; frame < 30; frame++) {
    simulation.tick()
    samples.push(nodes[1].y!)
    assert.equal(nodes[0].y, 260)
  }
  assert.ok(samples[0] > 100, 'the neighbor responds on the first tick')
  assert.ok(new Set(samples.map(y => y.toFixed(2))).size > 20, 'motion spans intermediate frames')
  pinNode(nodes[2], { x: 690, y: 169 })
  simulation.alpha(.35).alphaTarget(0).tick(300)
  assert.equal(nodes[0].y, 260, 'a subsequent drag preserves the previous pin')
  assert.equal(nodes[2].y, 200)
  assert.ok(simulation.alpha() < .001, 'animation settles after release')
  nodes[0].fx = nodes[0].fy = null
  simulation.alpha(.55).tick(120)
  assert.ok(nodes[0].y! < 250, 'unpinning lets the card rejoin the layout')
})

test('overlapping cards separate without moving a pinned card', () => {
  const nodes = [node('a', 140, 100), node('b', 145, 105)]
  const simulation = createMapSimulation(nodes, [])
  pinNode(nodes[0], { x: 30, y: 69 })
  simulation.alpha(.35).tick(100)
  assert.equal(nodes[0].x, 140)
  assert.equal(nodes[0].y, 100)
  assert.ok(Math.abs(nodes[1].y! - nodes[0].y!) >= 62)
})

test('relationships to cards that are not on the map are ignored', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0)]
  const simulation = createMapSimulation(nodes, [{ from: 'a', to: 'b' }, { from: 'a', to: 'hidden' }])
  simulation.alpha(.35).tick(10)
  for (const n of nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y))
})
