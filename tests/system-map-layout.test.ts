import { test } from 'node:test'
import assert from 'node:assert/strict'
import ELK from 'elkjs/lib/elk.bundled.js'
import { systemMapLayout } from '../src/lib/system-map-layout.ts'
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
