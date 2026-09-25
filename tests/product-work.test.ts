import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productWork } from '../src/data/product-work.ts'
import type { Feature, Component, Product } from '../shared/model.ts'

const products: Product[] = [
  { id: 'pricing', slug: 'pricing', name: 'Pricing', kind: 'service-system', repositories: [{ repository: 'acme/pricing', role: 'owned' }] },
  { id: 'cart', slug: 'cart', name: 'Cart', kind: 'service-system', repositories: [{ repository: 'acme/cart', role: 'owned' }] },
]
const components: Component[] = [
  { id: 'pricing-api', repo: 'acme/pricing', name: 'Pricing API' },
  { id: 'cart-api', repo: 'acme/cart', name: 'Cart API' },
]
const base = { ownerId: 'ryan', owner: 'Ryan', updatedAt: '2026-09-05', touches: ['pricing-api'] }
const features: Feature[] = [
  { ...base, id: 'local', productId: 'pricing', title: 'Bundle pricing', stage: 'designing' },
  { ...base, id: 'shared', productId: 'pricing', title: 'Regional tax', stage: 'building', touches: ['pricing-api', 'cart-api'] },
  { ...base, id: 'incoming', productId: 'cart', title: 'Cart recalculation', stage: 'building', touches: ['cart-api', 'pricing-api'] },
  { ...base, id: 'idea', productId: 'cart', title: 'Price estimates', stage: 'idea', touches: ['cart-api', 'pricing-api'] },
  { ...base, id: 'shipped', productId: 'pricing', title: 'Regional currency', stage: 'shipped' },
  { ...base, id: 'unrelated', productId: 'cart', title: 'Saved carts', stage: 'building', touches: ['cart-api'] },
]
const ids = (rows: Feature[]) => rows.map(row => row.id)

test('product work includes owned and incoming plans exactly once, with lifecycle counts', () => {
  const result = productWork(features, components, products, 'pricing', { status: 'active' })
  assert.deepEqual(ids(result.rows), ['local', 'shared', 'incoming'])
  assert.deepEqual(result.counts, { active: 3, ideas: 1, shipped: 1 })
})

test('ownership and multi-product filters distinguish incoming, outgoing and local plans', () => {
  assert.deepEqual(ids(productWork(features, components, products, 'pricing', { status: 'active', involvement: 'owned' }).rows), ['local', 'shared'])
  assert.deepEqual(ids(productWork(features, components, products, 'pricing', { status: 'active', involvement: 'incoming' }).rows), ['incoming'])
  assert.deepEqual(ids(productWork(features, components, products, 'pricing', { status: 'active', involvement: 'shared' }).rows), ['shared', 'incoming'])
  assert.deepEqual(ids(productWork(features, components, products, 'pricing', { status: 'ideas', involvement: 'incoming' }).rows), ['idea'])
})

test('stage, search and component filters compose without changing lifecycle semantics', () => {
  const result = productWork(features, components, products, 'pricing', { status: 'active', stage: 'building', search: 'tax',
    componentIds: new Set(['pricing-api']) })
  assert.deepEqual(ids(result.rows), ['shared'])
  assert.deepEqual(productWork(features, components, products, 'pricing', { status: 'active', componentIds: new Set(['missing']) }).rows, [])
  assert.deepEqual(ids(productWork(features, components, products, 'pricing', { status: 'shipped', stage: 'building' }).rows), ['shipped'])
})
