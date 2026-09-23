import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Component, Feature } from '../src/data/model.ts'
import { architectureSystemGraph, componentScopeIds, componentPath, componentTree, featureComponents, featureTouchesComponent, changesOverlap, runtimeSystemGraph, systemGraph } from '../src/data/component-structure.ts'
import { buildIndex, lensFor } from '../src/data/spec-index.ts'
import { loadContent } from '../src/data/content.ts'
import { livePrototypeIds } from '../src/data/live-prototypes.ts'
import { documents } from './fixtures.ts'

const components: Component[] = [
  { id: 'app', productId: 'p', name: 'App', kind: 'service', dependsOn: ['core'] },
  { id: 'capture', productId: 'p', name: 'Capture', kind: 'module', parentId: 'app' },
  { id: 'buffer', productId: 'p', name: 'Audio buffer', kind: 'local-storage', parentId: 'capture' },
  { id: 'editor', productId: 'p', name: 'Editor', kind: 'module', parentId: 'app' },
  { id: 'core', productId: 'p', name: 'Core', kind: 'service', dependsOn: ['postgres', 'provider'] },
  { id: 'postgres', productId: 'p', name: 'Postgres', kind: 'database' },
  { id: 'provider', productId: 'p', name: 'Provider', kind: 'external-service' },
]
const feature: Feature = { id: 'f', productId: 'p', title: 'Capture', stage: 'building', ownerId: 'ryan', owner: 'Ryan', touches: ['buffer'], updatedAt: '2026-09-05T00:00:00Z', spec: {
  flow: { nodes: [{ id: 'save', label: 'Save audio', kind: 'store', component: 'buffer', col: 0, row: 0 }], edges: [] },
  journey: { steps: [{ id: 'record', actor: 'User', action: 'Record', flow: ['save'] }] },
  storage: { tables: [{ id: 'chunks', component: 'buffer', name: 'Audio chunks', kind: 'local-file', change: 'unspecified', columns: [] }] },
  api: { contracts: [{ id: 'provider-call', name: 'Provider call', from: 'core', to: 'provider', path: '/transcribe', change: 'unspecified' }] },
  tests: { cases: [{ id: 't', title: 'Retain audio', given: 'Recording', when: 'Disconnected', then: ['Audio retained'], tables: ['chunks'] }] },
} }

test('containment scopes recursively include internals but never dependencies', () => {
  assert.deepEqual(componentScopeIds('app', components), new Set(['app', 'capture', 'editor', 'buffer']))
  assert.equal(featureTouchesComponent(feature, 'app', components), true)
  assert.equal(featureTouchesComponent({ ...feature, touches: ['core'] }, 'app', components), false)
  assert.equal(componentPath('buffer', components), 'App / Capture / Audio buffer')
  assert.deepEqual(componentTree(components).slice(0, 4).map(row => [row.component.id, row.depth]), [['app', 0], ['capture', 1], ['buffer', 2], ['editor', 1]])
})
test('feature participants include actual external use and ancestors without claiming changes', () => {
  const participants = featureComponents(feature, components).map(c => c.id)
  assert.deepEqual(participants, ['app', 'capture', 'buffer', 'core', 'provider'])
  assert.equal(participants.includes('postgres'), false)
  assert.equal(featureTouchesComponent(feature, 'provider', components), false)
})
test('a service lens finds child storage, flows, journeys and evidence without swallowing provider contracts', () => {
  const spec = feature.spec!
  const lens = lensFor(spec, buildIndex(spec), componentScopeIds('app', components))
  assert.deepEqual([...lens.storage!], ['chunks'])
  assert.deepEqual([...lens.flow!], ['save'])
  assert.deepEqual([...lens.journey!], ['record'])
  assert.deepEqual([...lens.tests!], ['t'])
  assert.deepEqual([...lens.api!], [])
  const provider = lensFor(spec, buildIndex(spec), 'provider')
  assert.deepEqual([...provider.api!], ['provider-call'])
})
test('coordination detects parent/child overlap without treating siblings or dependencies as the same work', () => {
  assert.equal(changesOverlap(feature, { touches: ['app'] }, components), true)
  assert.equal(changesOverlap(feature, { touches: ['editor'] }, components), false)
  assert.equal(changesOverlap({ touches: ['app'] }, { touches: ['core'] }, components), false)
})
test('invalid containment and dependency references are rejected before rendering', () => {
  const check = (edit: (data: Record<string, any>) => void, error: RegExp) => {
    const input = structuredClone(documents) as Record<string, any>
    edit(input)
    assert.throws(() => loadContent(input, livePrototypeIds), error)
  }
  const cart = 'components/c-cart-svc.json', cache = 'components/c-cart-cache.json'
  check(d => { d[cache].parentId = 'missing' }, /parentId: unknown reference/)
  check(d => { d[cart].parentId = 'c-cart-cache'; d[cache].parentId = 'c-cart-svc' }, /containment cycle/)
  check(d => { d[cache].parentId = 'c-pricing-api' }, /same product/)
  check(d => { d[cache].kind = 'database'; d[cart].parentId = 'c-cart-cache' }, /only a service or module/)
  check(d => { d[cache].kind = 'external-service'; d[cache].parentId = 'c-cart-svc' }, /must be top-level/)
  check(d => { d[cart].dependsOn = ['missing'] }, /dependsOn: unknown reference/)
  check(d => { d[cart].dependsOn = ['c-cart-svc'] }, /cannot depend on itself/)
  check(d => { d[cart].dependsOn = ['c-cart-cache', 'c-cart-cache'] }, /dependsOn: duplicate/)
  check(d => { d[cart].dependsOn = ['c-mac-app'] }, /another workspace/)
})
test('reciprocal runtime service dependencies are valid and do not become a containment cycle', () => {
  const input = structuredClone(documents) as Record<string, any>
  input['components/c-cart-svc.json'].dependsOn = ['c-pricing-api']
  input['components/c-pricing-api.json'].dependsOn = ['c-cart-svc']
  assert.doesNotThrow(() => loadContent(input, livePrototypeIds))
})


test('product system graph rolls internals into owners and deduplicates shared dependencies', () => {
  const input = structuredClone(components)
  input.find(c => c.id === 'capture')!.dependsOn = ['core', 'buffer', 'postgres']
  input.find(c => c.id === 'buffer')!.dependsOn = ['postgres']
  input.find(c => c.id === 'core')!.dependsOn!.push('capture')
  const graph = systemGraph(input)
  assert.deepEqual(graph.nodes.map(n => n.id), ['app', 'core', 'postgres', 'provider'])
  assert.deepEqual(graph.edges, [
    { from: 'app', to: 'core' }, { from: 'app', to: 'postgres' },
    { from: 'core', to: 'postgres' }, { from: 'core', to: 'provider' }, { from: 'core', to: 'app' },
  ])
  assert.equal(graph.edges.some(e => e.from === e.to), false)
})
test('runtime system graph separates supporting modules without hiding isolated services', () => {
  const runtime: Component = { id: 'runtime', name: 'Runtime', productId: 'product', kind: 'service' }
  const isolated: Component = { id: 'docs', name: 'Docs', productId: 'product', kind: 'service', dependsOn: [] }
  const supporting: Component = { id: 'platform', name: 'Platform', productId: 'product', kind: 'module', dependsOn: ['runtime', 'docs'] }
  const graph = runtimeSystemGraph([runtime, isolated, supporting])
  assert.deepEqual(graph.nodes.map(component => component.id), ['runtime', 'docs'])
  assert.deepEqual(graph.supporting.map(component => component.id), ['platform'])
  assert.deepEqual(graph.edges, [])
})
test('architecture system graph adds observed infrastructure without promoting it to a component', () => {
  const app: Component = {
    id: 'app', name: 'App', productId: 'product', kind: 'service',
    data: { technology: 'Browser Origin Private File System (OPFS)', access: ['read', 'write'], records: [] },
  }
  const core: Component = {
    id: 'core', name: 'Core', productId: 'product', kind: 'service',
    unresolvedDependencies: [
      { name: 'PostgreSQL', kind: 'database', transport: 'TCP', evidence: [{ path: 'db.go', lines: '1', claim: 'Connects to Postgres', revision: 'abc' }] },
      { name: 'Events', kind: 'message broker', transport: 'Pub/Sub', evidence: [{ path: 'events.go', lines: '1', claim: 'Publishes events', revision: 'abc' }] },
    ],
  }
  const graph = architectureSystemGraph([app, core], [])
  assert.deepEqual(graph.nodes.map(component => [component.name, component.kind]), [
    ['App', 'service'], ['Core', 'service'], ['Browser Origin Private File System (OPFS)', 'local-storage'], ['PostgreSQL', 'database'], ['Events', 'queue'],
  ])
  assert.deepEqual(graph.edges, [
    { from: 'app', to: 'observed-local-storage-browser-origin-private-file-system-opfs' },
    { from: 'core', to: 'observed-database-postgresql' },
    { from: 'core', to: 'observed-queue-events' },
  ])
  assert.equal(graph.status.get('observed-database-postgresql'), 'unresolved')
  assert.equal(graph.status.get('observed-local-storage-browser-origin-private-file-system-opfs'), 'observed')
})
test('architecture map points inbound event brokers toward consumers and outbound events toward brokers', () => {
  const service: Component = {
    id: 'facade', productId: 'product', name: 'Facade', kind: 'service',
    unresolvedDependencies: [
      { name: 'Azure Event Hubs', kind: 'event broker', evidence: [{ path: 'README.md', lines: '1', claim: 'Consumes notifications', revision: 'abc' }] },
    ],
    messaging: { messages: [
      { id: 'notification', name: 'Notification', broker: 'Azure Event Hubs (Event Grid notification)', channel: 'notifications', direction: 'inbound', fields: [], delivery: { ordering: 'Unknown', retries: 'Unknown', deadLetter: 'Unknown' } },
      { id: 'reply', name: 'Reply', broker: 'Kafka', channel: 'replies', direction: 'outbound', fields: [], delivery: { ordering: 'Unknown', retries: 'Unknown', deadLetter: 'Unknown' } },
    ] },
  }
  const graph = architectureSystemGraph([service], [])
  assert.deepEqual(graph.nodes.map(node => node.name), ['Facade', 'Azure Event Hubs', 'Kafka'])
  assert.deepEqual(graph.edges, [
    { from: 'observed-queue-azure-event-hubs', to: 'facade', messages: { inbound: 1, outbound: 0 } },
    { from: 'facade', to: 'observed-queue-kafka', messages: { inbound: 0, outbound: 1 } },
  ])
  assert.equal(graph.status.get('observed-queue-azure-event-hubs'), 'unresolved')
  assert.equal(graph.status.get('observed-queue-kafka'), 'observed')
})
test('architecture map shows a single bidirectional broker link when both directions are catalogued', () => {
  const app: Component = {
    id: 'app', productId: 'p', name: 'App', kind: 'service', dependsOn: ['broker'],
    messaging: { messages: [
      { id: 'consume', name: 'Consume', broker: 'Kafka', channel: 'input', direction: 'inbound', fields: [], delivery: { ordering: 'Unknown', retries: 'Unknown', deadLetter: 'Unknown' } },
      { id: 'publish', name: 'Publish', broker: 'Kafka', channel: 'output', direction: 'outbound', fields: [], delivery: { ordering: 'Unknown', retries: 'Unknown', deadLetter: 'Unknown' } },
    ] },
  }
  const broker: Component = { id: 'broker', productId: 'p', name: 'Kafka', kind: 'queue' }
  const graph = architectureSystemGraph([app, broker], [{ from: 'app', to: 'broker' }])
  assert.deepEqual(graph.edges, [{ from: 'app', to: 'broker', messages: { inbound: 1, outbound: 1 } }])
  assert.equal(graph.nodes.length, 2)
})
test('product configuration facade map includes its catalogued inbound event sources', () => {
  const catalog: Component[] = JSON.parse(readFileSync(new URL('./fixtures/catalog/components.json', import.meta.url), 'utf8'))
  const facade = catalog.find(component => component.id === 'product-configuration-facade')!
  const graph = architectureSystemGraph([facade], [])
  assert.deepEqual(graph.edges.filter(edge => edge.messages).map(edge => [graph.nodes.find(node => node.id === edge.from)!.name, graph.nodes.find(node => node.id === edge.to)!.name, edge.messages]), [
    ['Product Configuration Facade', 'Confluent Kafka', { inbound: 0, outbound: 15 }],
    ['ICOE Kafka', 'Product Configuration Facade', { inbound: 2, outbound: 0 }],
    ['Azure Event Hubs', 'Product Configuration Facade', { inbound: 6, outbound: 0 }],
  ])
  assert.equal(graph.nodes.filter(node => node.name === 'Azure Event Hubs').length, 1)
})
test('product map retains cross-product dependencies without pulling in their whole system', () => {
  const input = structuredClone(components)
  const external: Component = { id: 'other', name: 'Other service', productId: 'other-product', kind: 'service', dependsOn: ['unused'] }
  input.find(c => c.id === 'buffer')!.dependsOn = ['other']
  const graph = systemGraph(input, [...input, external, { id: 'unused', name: 'Unrelated', productId: 'other-product' }])
  assert.equal(graph.nodes.at(-1)!.id, 'other')
  assert.equal(graph.nodes.some(n => n.id === 'unused'), false)
  assert.deepEqual(graph.edges.find(e => e.to === 'other'), { from: 'app', to: 'other' })
})


test('product maps include external users while leaving unrelated dependencies out', () => {
  const external: Component = { id: 'consumer', name: 'Consumer', productId: 'other-product', kind: 'service', dependsOn: ['buffer', 'unused'] }
  const graph = systemGraph(components, [...components, external, { id: 'unused', name: 'Unrelated', productId: 'other-product' }])
  assert.deepEqual(graph.edges.at(-1), { from: 'consumer', to: 'app' })
  assert.equal(graph.nodes.some(n => n.id === 'consumer'), true)
  assert.equal(graph.nodes.some(n => n.id === 'unused'), false)
})
