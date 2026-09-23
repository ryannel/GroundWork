import { test } from 'node:test'
import assert from 'node:assert/strict'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  edgeHandles, fallbackGridPositions, layoutSignature, messageEdgeLabel, portSide, relationshipId, systemMapLayout,
} from '../src/lib/system-map-layout.ts'
import { edgeRoutes } from '../src/lib/elk.ts'
import { nodeHeight, nodeWidth } from '../src/lib/system-map-physics.ts'
import type { Component } from '../src/data/model.ts'

const components: Component[] = ['App', 'Core', 'ML', 'Postgres', 'Object storage', 'AssemblyAI', 'OpenAI'].map((name, order) => ({
  id: `node-${order}`, name, order, productId: 'product',
}))
const relationships = [[0, 1], [1, 3], [1, 4], [1, 2], [2, 1], [2, 4], [2, 5], [2, 6]].map(([from, to]) => ({ from: `node-${from}`, to: `node-${to}` }))

test('auto layout aligns the entry chain, centers its continuation and places providers beyond it', async () => {
  const graph = await new ELK().layout(systemMapLayout(components, relationships))
  const [app, core, ml, db, storage, aai, openai] = components.map(c => graph.children!.find(n => n.id === c.id)!)
  assert.ok(app.x! < core.x! && core.x! < ml.x! && ml.x! < aai.x!)
  assert.equal(app.y, core.y)
  assert.equal(core.y, ml.y)
  assert.equal(storage.x, ml.x)
  assert.equal(db.x, ml.x)
  assert.ok(storage.y! < ml.y! && ml.y! < db.y!)
  assert.equal(aai.x, openai.x)
  assert.ok(aai.y! < ml.y! && ml.y! < openai.y!)
  assert.equal(graph.children!.length, 7)
  assert.equal(relationships.length, 8, 'placement does not modify the relationships rendered by the map')
})

test('layout does not depend on input array ordering', () => {
  assert.deepEqual(systemMapLayout([...components].reverse(), [...relationships].reverse()), systemMapLayout(components, relationships))
})

test('disconnected cycles, isolated nodes and shared targets are all placed once', async () => {
  const links = [relationships[0], { from: 'node-2', to: 'node-3' }, { from: 'node-3', to: 'node-2' }, { from: 'node-4', to: 'node-1' }]
  const input = systemMapLayout(components, links)
  const parents = input.edges!.map(edge => edge.targets[0])
  assert.equal(new Set(parents).size, parents.length)
  const graph = await new ELK().layout(input)
  assert.equal(new Set(graph.children!.map(n => n.id)).size, components.length)
  for (const a of graph.children!) {
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y))
    for (const b of graph.children!) {
      if (a.id === b.id) continue
      assert.ok(a.x! + a.width! <= b.x! || b.x! + b.width! <= a.x! || a.y! + a.height! <= b.y! || b.y! + b.height! <= a.y!)
    }
  }
})

test('empty and single-node maps have no artificial dependency', () => {
  assert.equal(systemMapLayout([], []).children!.length, 0)
  assert.equal(systemMapLayout([components[0]], [{ from: 'node-0', to: 'node-0' }]).edges!.length, 0)
})

test('duplicate component ids are placed once instead of crashing the layout loop', () => {
  const duplicate = components[0]
  const graph = systemMapLayout([duplicate, { ...duplicate }, components[1]], [{ from: 'node-0', to: 'node-1' }])
  assert.deepEqual(graph.children!.map(node => node.id), ['node-0', 'node-1'])
})

test('relationship ids are unambiguous for dash-heavy component ids', () => {
  assert.notEqual(relationshipId('a-b', 'c'), relationshipId('a', 'b-c'))
  assert.deepEqual(JSON.parse(relationshipId('observed-queue-kafka', 'x')), ['observed-queue-kafka', 'x'])
})

test('the layout signature changes with structure only', () => {
  const signature = layoutSignature(components, relationships)
  assert.equal(layoutSignature(components.map(c => ({ ...c, description: 'changed' })), relationships.map(r => ({ ...r }))), signature)
  assert.notEqual(layoutSignature(components.slice(1), relationships), signature)
  assert.notEqual(layoutSignature(components, relationships.slice(1)), signature)
  assert.notEqual(layoutSignature(components.map(c => c.id === 'node-0' ? { ...c, name: 'Web' } : c), relationships), signature)
})

test('edge ports face the other card along the dominant axis', () => {
  assert.equal(portSide({ x: 0, y: 0 }, { x: 300, y: 50 }), 'right')
  assert.equal(portSide({ x: 300, y: 0 }, { x: 0, y: 50 }), 'left')
  assert.equal(portSide({ x: 0, y: 0 }, { x: 10, y: 200 }), 'bottom')
  assert.equal(portSide({ x: 0, y: 200 }, { x: 10, y: 0 }), 'top')
  assert.deepEqual(edgeHandles('right'), { sourceHandle: 'source-right', targetHandle: 'target-left' })
  assert.deepEqual(edgeHandles('top'), { sourceHandle: 'source-top', targetHandle: 'target-bottom' })
})

test('message edges count contracts in each direction', () => {
  assert.equal(messageEdgeLabel(undefined), undefined)
  assert.equal(messageEdgeLabel({ inbound: 2, outbound: 1 }), '2 in · 1 out')
  assert.equal(messageEdgeLabel({ inbound: 0, outbound: 3 }), '3 out')
})

test('the fallback grid places every card without overlap', () => {
  const positions = [...fallbackGridPositions(components.map(c => c.id)).values()]
  assert.equal(positions.length, components.length)
  for (const a of positions) for (const b of positions) {
    if (a === b) continue
    assert.ok(a.x + nodeWidth <= b.x || b.x + nodeWidth <= a.x || a.y + nodeHeight <= b.y || b.y + nodeHeight <= a.y)
  }
})

test('ELK edge sections and labels convert to SVG routes with centred labels', async () => {
  const layout = await new ELK().layout({
    id: 'g', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.edgeRouting': 'ORTHOGONAL' },
    children: [{ id: 'a', width: 100, height: 40 }, { id: 'b', width: 100, height: 40 }],
    edges: [
      { id: 'e', sources: ['a'], targets: ['b'], labels: [{ text: 'next', width: 40, height: 20 }] },
      { id: 'unlabelled', sources: ['b'], targets: ['a'] },
    ],
  })
  const routes = edgeRoutes(layout)
  assert.deepEqual(Object.keys(routes), ['e'], 'edges without a positioned label are left to the default renderer')
  assert.match(routes.e.path, /^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+)+$/)
  const label = layout.edges![0].labels![0]
  assert.equal(routes.e.labelX, label.x! + 20)
  assert.equal(routes.e.labelY, label.y! + 10)
})
