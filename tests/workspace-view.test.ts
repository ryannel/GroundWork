import { test } from 'node:test'
import assert from 'node:assert/strict'
import { featureInProduct, connectedProductIds } from '../src/data/workspace-view.ts'
import type { Component, Feature } from '../src/data/model.ts'

const components: Component[] = [
  { id: 'pricing-api', productId: 'pricing', name: 'Pricing API' },
  { id: 'cart-api', productId: 'cart', name: 'Cart API' },
  { id: 'cart-db', productId: 'cart', name: 'Cart database' },
]
const feature: Feature = {
  id: 'tax', productId: 'pricing', title: 'Tax rules', stage: 'building', ownerId: 'ryan', owner: 'Ryan', updatedAt: '2026-09-05',
  touches: ['pricing-api', 'cart-api', 'cart-db', 'missing'],
}

test('product scope includes owned work and incoming work through components', () => {
  assert.equal(featureInProduct(feature, 'all', components), true)
  assert.equal(featureInProduct({ ...feature, touches: [] }, 'pricing', components), true)
  assert.equal(featureInProduct(feature, 'cart', components), true)
  assert.equal(featureInProduct(feature, 'checkout', components), false)
})

test('cross-product destinations exclude ownership, deduplicate products, and ignore missing components', () => {
  assert.deepEqual(connectedProductIds(feature, components), ['cart'])
  assert.deepEqual(connectedProductIds({ ...feature, touches: ['pricing-api', 'missing'] }, components), [])
  assert.deepEqual(connectedProductIds({ ...feature, touches: [] }, components), [])
})
