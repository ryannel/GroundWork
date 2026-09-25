import { test } from 'node:test'
import assert from 'node:assert/strict'
import { featureInProduct, connectedProductIds } from '../src/data/workspace-view.ts'
import type { Component, Feature, Product } from '../shared/model.ts'

const products: Product[] = [
  { id: 'pricing', slug: 'pricing', name: 'Pricing', kind: 'service-system', repositories: [{ repository: 'acme/pricing', role: 'owned' }] },
  { id: 'cart', slug: 'cart', name: 'Cart', kind: 'service-system', repositories: [{ repository: 'acme/cart', role: 'owned' }] },
]
const components: Component[] = [
  { id: 'pricing-api', repo: 'acme/pricing', name: 'Pricing API' },
  { id: 'cart-api', repo: 'acme/cart', name: 'Cart API' },
  { id: 'cart-db', repo: 'acme/cart', name: 'Cart database' },
]
const feature: Feature = {
  id: 'tax', productId: 'pricing', title: 'Tax rules', stage: 'building', ownerId: 'ryan', owner: 'Ryan', updatedAt: '2026-09-05',
  touches: ['pricing-api', 'cart-api', 'cart-db', 'missing'],
}

test('product scope includes owned work and incoming work through components', () => {
  assert.equal(featureInProduct(feature, 'all', components, products), true)
  assert.equal(featureInProduct({ ...feature, touches: [] }, 'pricing', components, products), true)
  assert.equal(featureInProduct(feature, 'cart', components, products), true)
  assert.equal(featureInProduct(feature, 'checkout', components, products), false)
})

test('cross-product destinations exclude ownership, deduplicate products, and ignore missing components', () => {
  assert.deepEqual(connectedProductIds(feature, components, products), ['cart'])
  assert.deepEqual(connectedProductIds({ ...feature, touches: ['pricing-api', 'missing'] }, components, products), [])
  assert.deepEqual(connectedProductIds({ ...feature, touches: [] }, components, products), [])
})
