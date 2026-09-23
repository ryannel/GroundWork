import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex, refLabel } from '../src/data/spec-index.ts'
import { loadContent } from '../src/data/content.ts'
import { livePrototypeIds } from '../src/data/live-prototypes.ts'
import type { FeatureSpec } from '../src/data/spec.ts'

// Valid IDs that collide with Object.prototype members or sort ahead of other keys.
const spec = (a: string, b: string, contract: string, step: string): FeatureSpec => ({
  purpose: { problem: 'P', outcome: 'O', success: [{ id: 'valueOf', text: 'Works', tests: ['toString'] }] },
  journey: { steps: [
    { id: 's-a', actor: 'User', action: 'Start', flow: [a, b] },
    { id: step, actor: 'User', action: 'Save', flow: [a, b] },
    { id: '10', actor: 'System', action: 'Confirm' },
  ] },
  flow: {
    nodes: [
      { id: a, label: 'Client', kind: 'process', component: 'client', col: 0, row: 0 },
      { id: b, label: 'Server', kind: 'process', component: 'server', col: 1, row: 0, tables: ['isPrototypeOf'] },
    ],
    edges: [{ id: 'hasOwnProperty', from: a, to: b, contracts: [contract] }],
  },
  api: { contracts: [{ id: contract, name: 'Save', change: 'added', from: 'client', to: 'server', method: 'POST', path: '/save' }] },
  storage: { tables: [{ id: 'isPrototypeOf', component: 'server', name: 'items', change: 'added', columns: [] }] },
  tests: { cases: [{ id: 'toString', title: 'Saves', given: 'G', when: 'W', then: ['T'], steps: [step], contracts: [contract], tables: ['isPrototypeOf'] }] },
})

test('indexes accept IDs that look like Object.prototype members', () => {
  const ix = buildIndex(spec('toLocaleString', 'propertyIsEnumerable', 'hasOwnProperty', '2'))
  assert.deepEqual(ix.stepContracts['2'], ['hasOwnProperty'])
  assert.deepEqual(ix.contractSteps.hasOwnProperty, ['s-a', '2'])
  assert.equal(ix.contractEdge.hasOwnProperty, 'hasOwnProperty')
  assert.deepEqual(ix.contractTests.hasOwnProperty, ['toString'])
  assert.deepEqual(ix.tableSteps.isPrototypeOf, ['s-a', '2'])
  assert.deepEqual(ix.testCriteria.toString, ['valueOf'])
  assert.deepEqual(new Set(ix.testNodes.toString), new Set(['toLocaleString', 'propertyIsEnumerable']))
  assert.deepEqual(ix.testEdges.toString, ['hasOwnProperty'])
  assert.deepEqual(new Set(ix.testSpans.toString), new Set(['client', 'server']))
  assert.deepEqual(ix.untestedSteps, ['s-a', '10'])
  assert.deepEqual(ix.untestedContracts, [])
  assert.deepEqual(ix.unprovenCriteria, [])
  // Unknown lookups miss instead of returning inherited functions.
  assert.equal(ix.step.constructor, undefined)
  assert.equal(ix.contractEdge.toString, undefined)
  assert.equal(ix.stepTests.valueOf, undefined)
})

test('a contract that is never placed on an edge does not break test tracing', () => {
  const input = spec('a', 'b', 'c', '2')
  input.flow!.edges[0].contracts = []
  const ix = buildIndex(input)
  assert.deepEqual(ix.testEdges.toString, ['hasOwnProperty'])
})

test('step labels follow journey order even for numeric IDs', () => {
  const ix = buildIndex(spec('a', 'b', 'c', '2'))
  assert.deepEqual(['s-a', '2', '10'].map(id => refLabel(ix, { kind: 'journey', id })?.title), ['Step 1', 'Step 2', 'Step 3'])
  assert.equal(refLabel(ix, { kind: 'journey', id: 'toString' }), undefined)
  assert.equal(refLabel(ix, { kind: 'api', id: 'c' })?.title, 'POST /save')
  assert.equal(refLabel(ix, { kind: 'tests', id: 'toString' })?.sub, 'Saves')
})

test('a validated plan with reserved-looking IDs indexes without throwing', () => {
  const documents: Record<string, unknown> = {
    'project.json': { schemaVersion: 1 },
    'workspaces/w.json': { id: 'w', slug: 'w', name: 'W', hue: 'var(--hue-teal)', createdAt: '2026-09-01T00:00:00Z' },
    'products/p.json': { id: 'p', workspaceId: 'w', slug: 'p', name: 'P', kind: 'library' },
    'components/client.json': { id: 'client', productId: 'p', name: 'Client' },
    'components/server.json': { id: 'server', productId: 'p', name: 'Server' },
    'members/m.json': { id: 'm', name: 'M' },
    'features/f/feature.json': { id: 'f', productId: 'p', title: 'F', stage: 'specced', touches: ['client'], ownerId: 'm', updatedAt: '2026-09-05T10:00:00Z' },
  }
  for (const [section, value] of Object.entries(spec('toLocaleString', 'propertyIsEnumerable', 'hasOwnProperty', '2'))) {
    documents[`features/f/${section}.json`] = value
  }
  const snapshot = loadContent(documents, livePrototypeIds)
  assert.doesNotThrow(() => buildIndex(snapshot.features[0].spec!))
})
