import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRepository, type ContentSnapshot } from '../src/data/content.ts'
import { featureTouchesComponent, componentPath } from '../src/data/component-structure.ts'
import { homeView, isActive, productView, repositoryFor, workspaceView } from '../src/data/store.ts'
import type { Component, Feature } from '../src/data/model.ts'
import { snapshot } from './fixtures.ts'

const nested: Component[] = [
  { id: 'app', productId: 'p', name: 'App', kind: 'service' },
  { id: 'capture', productId: 'p', name: 'Capture', kind: 'module', parentId: 'app' },
  { id: 'buffer', productId: 'p', name: 'Buffer', kind: 'local-storage', parentId: 'capture' },
  { id: 'loop-a', productId: 'p', name: 'Loop A', parentId: 'loop-b' },
  { id: 'loop-b', productId: 'p', name: 'Loop B', parentId: 'loop-a' },
]
const nestedSnapshot: ContentSnapshot = {
  ...snapshot, workspaces: [], products: [], features: [], components: nested,
}

test('the repository indexes containment scopes and ancestors once per snapshot', () => {
  const { q } = createRepository(nestedSnapshot)
  assert.deepEqual(q.scope('app'), new Set(['app', 'capture', 'buffer']))
  assert.equal(q.scope('app'), q.scope('app'), 'scopes are memoised')
  assert.deepEqual(q.ancestors('buffer').map(c => c.id), ['app', 'capture', 'buffer'])
  assert.deepEqual(q.ancestors('loop-a').map(c => c.id), ['loop-b', 'loop-a'], 'containment cycles terminate')
  assert.deepEqual(q.ancestors('missing'), [])
  assert.equal(q.componentLabel('buffer'), componentPath('buffer', nested))
  assert.equal(q.touches({ touches: ['buffer'] }, 'app'), true)
  assert.equal(q.touches({ touches: ['app'] }, 'buffer'), false)
})

test('one repository is shared per snapshot', () => {
  assert.equal(repositoryFor(snapshot), repositoryFor(snapshot))
  assert.notEqual(repositoryFor(snapshot), repositoryFor(nestedSnapshot))
  assert.equal(repositoryFor(null), repositoryFor(undefined))
})

test('workspace and product views match the direct scope calculation', () => {
  const repository = repositoryFor(snapshot)
  const view = workspaceView(repository, 'ecom')!
  assert.equal(view.workspace.id, 'w-ecom')
  const active = snapshot.features.filter(f => isActive(f) && repository.q.product(f.productId)?.workspaceId === 'w-ecom')
  for (const load of view.load) {
    assert.deepEqual(
      new Set(load.features.map(f => f.id)),
      new Set(active.filter(f => featureTouchesComponent(f, load.component.id, snapshot.components)).map(f => f.id)),
    )
  }
  const cart = view.load.find(l => l.component.id === 'c-cart-svc')!
  assert.equal(cart.crossProduct, true)
  assert.ok(view.reaching.some(f => f.id === 'f-2'))
  assert.equal(workspaceView(repository, 'missing'), undefined)

  const product = productView(repository, 'ecom', 'cart')!
  const cartSvc = product.components.find(c => c.component.id === 'c-cart-svc')!
  assert.deepEqual(cartSvc.touchedBy.map(f => f.id).sort(), ['f-2', 'f-3'])
  assert.deepEqual(product.incoming.map(f => f.id), ['f-2'])
  assert.equal(productView(repository, 'ecom', 'missing'), undefined)
})

test('the home view counts cold work against the supplied clock', () => {
  const repository = repositoryFor(snapshot)
  const latest = Math.max(...snapshot.features.map((f: Feature) => Date.parse(f.updatedAt)))
  const now = homeView(repository, latest)
  assert.equal(now.cold, now.inFlight.filter(f => latest - Date.parse(f.updatedAt) > 14 * 864e5).length)
  assert.equal(homeView(repository, Date.parse(snapshot.features.reduce((a, b) => a.updatedAt < b.updatedAt ? a : b).updatedAt)).cold, 0)
  const later = homeView(repository, latest + 365 * 864e5)
  assert.equal(later.cold, later.inFlight.length)
  assert.equal(later.totals.workspaces, snapshot.workspaces.length)
  assert.equal(later.totals.ideas, snapshot.features.filter(f => f.stage === 'idea').length)
})
