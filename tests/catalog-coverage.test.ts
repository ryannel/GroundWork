import { test } from 'node:test'
import assert from 'node:assert/strict'
import { componentCoverage, productCoverage } from '../src/data/catalog-coverage.ts'
import type { Component } from '../src/data/model.ts'

const component = (patch: Partial<Component> = {}): Component => ({
  id: 'service', productId: 'product', order: 0, name: 'Service', kind: 'service', ...patch,
})

test('missing catalog fields remain unknown until a scan explicitly completes them', () => {
  const unknown = componentCoverage(component({ repo: 'org/service' }))
  assert.equal(unknown.status, 'not-scanned')
  assert.equal(unknown.area('data'), 'not-scanned')
  assert.equal(unknown.area('messaging'), 'not-scanned')

  const complete = componentCoverage(component({ scan: { status: 'complete' } }))
  assert.equal(complete.area('data'), 'complete')
  assert.equal(complete.area('dependencies'), 'complete')
})

test('observed evidence implies partial coverage but never completeness', () => {
  const coverage = componentCoverage(component({
    dependsOn: [],
    api: { name: 'Service API', endpoints: [] },
  }))
  assert.equal(coverage.status, 'partial')
  assert.equal(coverage.area('dependencies'), 'partial')
  assert.equal(coverage.area('api'), 'partial')
  assert.equal(coverage.area('data'), 'not-scanned')
})

test('product coverage only reports complete when every component scan is complete', () => {
  assert.deepEqual(productCoverage([
    component({ id: 'one', scan: { status: 'complete' } }),
    component({ id: 'two', scan: { status: 'partial' } }),
  ]), { total: 2, complete: 1, incomplete: 1, status: 'partial' })
})
