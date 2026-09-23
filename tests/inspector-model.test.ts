import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeTab, clearRetiredSelection, dependencyContextLabel, emptyCatalogText, endpointEntries, endpointMatches, flowOrigin, followFlowLink,
  inspectorTabs, mentalModel, readableList, referencedSchemas, retiredSelection, returnToOrigin, schemaIndex, selectTab, tabAriaLabel,
  type ApiType,
} from '../src/data/inspector-model.ts'
import type { Component } from '../src/data/model.ts'
import { rovingTarget } from '../src/lib/use-roving-tabs.ts'

const sha = 'b'.repeat(40)
const evidence = [{ path: 'src/a.ts', lines: '1', revision: sha, claim: 'seen' }]
const field = (name: string, type: string) => ({ name, type, required: true })
const base = { productId: 'p', order: 0 }

test('schemas resolve by id; a shared name yields every candidate instead of the last one', () => {
  const v1 = { id: 'v1-order', name: 'Order', kind: 'record', fields: [field('total', 'int')] }
  const v2 = { id: 'v2-order', name: 'Order', kind: 'record', fields: [field('amount', 'Money')] }
  const money = { id: 'money', name: 'Money', kind: 'record', fields: [] }
  const index = schemaIndex([v1, v2, money] as ApiType[])
  assert.equal(index.byId.get('v1-order'), v1)
  assert.deepEqual(referencedSchemas('List<Order>', index).map(schema => schema.id), ['v1-order', 'v2-order'])
  assert.deepEqual(referencedSchemas('Map<string, Money>', index).map(schema => schema.id), ['money'])
  assert.deepEqual(referencedSchemas(undefined, index), [])
})

test('endpoint entries search referenced schema fields and mark traced endpoints', () => {
  const component: any = {
    ...base, id: 'c', name: 'C',
    api: {
      name: 'api',
      endpoints: [
        { id: 'get', name: 'Get order', method: 'GET', path: '/v1/orders/{id}', response: 'Order', version: 'v1' },
        { id: 'post', name: 'Create', method: 'POST', path: '/api/v2/orders', request: 'Order' },
      ],
      schemas: [{ id: 'order', name: 'Order', kind: 'record', fields: [field('shippingAddress', 'Address')] }],
    },
    executionFlows: [{ id: 'f', endpointId: 'post' }],
  }
  const entries = endpointEntries(component, schemaIndex(component.api.schemas))
  assert.deepEqual(entries.map(entry => [entry.id, entry.group, entry.annotation]), [['get', 'orders', undefined], ['post', 'orders', 'Data flow traced']])
  assert.match(entries[0].search, /shippingAddress Address/)
  assert.ok(endpointMatches(component.api.endpoints[0], 'GET', 'v1'))
  assert.ok(!endpointMatches(component.api.endpoints[1], 'all', 'v1'))
  assert.ok(endpointMatches(component.api.endpoints[1]))
})

test('tab counts show a dash until an area is established, and jobs appear only when catalogued', () => {
  const empty: any = { ...base, id: 'c', name: 'C', api: { name: 'a', endpoints: [] } }
  assert.deepEqual(inspectorTabs(empty).map(tab => [tab.id, tab.count]), [['overview', null], ['api', '—'], ['data', '—'], ['messages', '—']])
  const scanned: any = { ...empty, scan: { status: 'complete' }, jobs: [{ id: 'j', name: 'J', description: '', evidence }] }
  const tabs = inspectorTabs(scanned)
  assert.deepEqual(tabs.map(tab => [tab.id, tab.count]), [['overview', null], ['api', 0], ['data', 0], ['messages', 0], ['jobs', 1]])
  assert.equal(tabAriaLabel(tabs[1]), 'Interfaces: 0 catalogued')
  assert.equal(tabAriaLabel(inspectorTabs(empty)[2]), 'Data: not yet established')
  assert.equal(activeTab(tabs, 'jobs'), 'jobs')
  assert.equal(activeTab(inspectorTabs(empty), 'jobs'), 'overview', 'a tab the component lacks falls back to the overview')
  assert.equal(activeTab(tabs, undefined), 'overview')
})

test('changing tab clears a retired selection so the chosen panel is shown', () => {
  const component: any = {
    ...base, id: 'c', name: 'C',
    retiredObservations: [
      { kind: 'data', id: 'old-table', reason: 'Dropped', sourceRevision: sha, evidence, observation: { name: 'old' } },
      { kind: 'flow', id: 'old-flow', reason: 'Gone', sourceRevision: sha, evidence, observation: {} },
    ],
  }
  const location = { catalog: 'data', dataEntity: 'old-table', flow: 'old-flow', apiEntity: 'live' }
  assert.equal(retiredSelection(component, location)?.id, 'old-table')
  assert.deepEqual(clearRetiredSelection(component, location), { dataEntity: undefined, flow: undefined })
  const next = { ...location, ...selectTab(component, location, 'api') }
  assert.equal(retiredSelection(component, next), undefined)
  assert.equal(next.catalog, 'api')
  assert.equal(next.apiEntity, 'live', 'active selections survive')
  assert.deepEqual(selectTab({ ...base, id: 'x', name: 'X' } as Component, {}, 'data'), { catalog: 'data', from: undefined })
})

test('the flow breadcrumb round-trips through the URL', () => {
  const component: any = {
    ...base, id: 'c', name: 'C',
    api: { name: 'a', endpoints: [{ id: 'post:orders', name: 'Create', method: 'POST', path: '/orders' }] },
    messaging: { messages: [{ id: 'placed', name: 'OrderPlaced' }] },
  }
  const patch = followFlowLink({ tab: 'data', id: 'orders-table' }, { tab: 'api', id: 'post:orders' })
  assert.equal(patch.from, 'api:post:orders')
  assert.equal(patch.dataEntity, 'orders-table')
  const origin = flowOrigin(component, patch.from)!
  assert.deepEqual(origin, { tab: 'api', id: 'post:orders', name: 'Create', label: 'POST /orders' })
  assert.deepEqual(returnToOrigin(origin), { catalog: 'api', apiEntity: 'post:orders', from: undefined, apiView: 'flow' })
  assert.deepEqual(flowOrigin(component, 'messages:placed'), { tab: 'messages', id: 'placed', name: 'OrderPlaced', label: 'OrderPlaced' })
  assert.equal(flowOrigin(component, 'messages:missing'), undefined)
  assert.equal(flowOrigin(component, 'nonsense'), undefined)
  assert.equal(flowOrigin(component, 'overview:x'), undefined)
})

test('dependency context labels distinguish platforms, providers and ownership', () => {
  const dependency = (extra: object) => ({ ...base, id: 'd', name: 'D', ...extra }) as Component
  assert.equal(dependencyContextLabel(dependency({ role: 'platform-service', ownership: 'third-party' })), 'External platform')
  assert.equal(dependencyContextLabel(dependency({ role: 'platform-service' })), 'Internal platform')
  assert.equal(dependencyContextLabel(dependency({ role: 'external-provider' })), 'External provider')
  assert.equal(dependencyContextLabel(dependency({ ownership: 'third-party', kind: 'database' })), 'External service')
  assert.equal(dependencyContextLabel(dependency({ kind: 'external-service' })), 'Internal service')
  assert.equal(dependencyContextLabel(dependency({ kind: 'cache' })), 'Cache')
})

test('the mental model is assembled from catalog records only', () => {
  assert.equal(readableList([]), '')
  assert.equal(readableList(['a', 'b']), 'a and b')
  assert.equal(readableList(['a', 'b', 'c']), 'a, b, and c')
  const component: any = {
    ...base, id: 'c', name: 'C',
    api: { name: 'a', endpoints: [{ method: 'GET' }, { method: 'EVENT' }] },
    data: { technology: 'Postgres', access: ['read', 'write'], records: [] },
    messaging: { messages: [{ direction: 'outbound' }] },
    unresolvedDependencies: ['a', 'b', 'c', 'd', 'e'].map(name => ({ name, evidence })),
  }
  // A deliberately incomplete dependency: mentalModel only reads its name for this label.
  const model = mentalModel(component, [{ name: 'Billing' }] as unknown as Component[])
  assert.match(model.enters, /^Treat HTTP interfaces and event interfaces as the component's known entry points\./)
  assert.match(model.inside, /^The catalog shows read and write access to Postgres\./)
  assert.match(model.leaves, /^Mapped processing crosses into Billing, and the component also records outbound messages\./)
  assert.match(model.blindSpots!, /^a, b, c, and d and 1 more are referenced in source/)
  const isolated = mentalModel({ ...base, id: 'x', name: 'X' } as Component, [])
  assert.match(isolated.enters, /^No entry point has been established/)
  assert.match(isolated.leaves, /^No outgoing component or message boundary/)
  assert.equal(isolated.blindSpots, undefined)
  assert.match(mentalModel({ ...base, id: 'x', name: 'X', messaging: { messages: [{ direction: 'outbound' }] } } as Component, []).leaves,
    /^No component dependency is currently mapped, but the component also records outbound messages\./)
})

test('empty tabs distinguish a complete scan from an area not yet investigated', () => {
  const component: any = { ...base, id: 'c', name: 'C' }
  assert.equal(emptyCatalogText(component, 'api', 'interfaces').title, 'Interfaces not yet catalogued')
  assert.equal(emptyCatalogText({ ...component, scan: { status: 'complete' } }, 'api', 'interfaces').title, 'No interfaces found in the scan')
})

test('roving tabs wrap with arrows, jump with Home/End and ignore other keys', () => {
  const ids = ['overview', 'api', 'data']
  assert.equal(rovingTarget(ids, 'overview', 'ArrowLeft'), 'data')
  assert.equal(rovingTarget(ids, 'data', 'ArrowRight'), 'overview')
  assert.equal(rovingTarget(ids, 'api', 'Home'), 'overview')
  assert.equal(rovingTarget(ids, 'api', 'End'), 'data')
  assert.equal(rovingTarget(ids, 'api', 'Enter'), undefined)
  assert.equal(rovingTarget([], 'api', 'End'), undefined)
})
