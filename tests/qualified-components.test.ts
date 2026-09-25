import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Component } from '../src/data/model.ts'
import { runtimeSystemGraph } from '../src/data/component-structure.ts'
import { qualifyViewerComponents, selectViewerComponentId, viewerComponentId } from '../src/ui/qualified-components.ts'

const component = (id: string, repo?: string, patch: Partial<Component> = {}): Component => ({
  id, name: id, order: 0, kind: 'service', ...(repo ? { repo } : {}), ...patch,
})

test('same local ID in two repositories remains two graph nodes and qualified dependencies point to the right one', () => {
  const first = component('api', 'acme/first')
  const second = component('api', 'acme/second')
  const caller = component('caller', 'acme/home', {
    dependsOn: [{ repository: 'git@github.com:acme/second.git', component: 'api' }, 'api'],
  })
  const source = [first, second, caller]
  const result = qualifyViewerComponents(source, 'acme/home')
  const firstId = viewerComponentId('acme/first', 'api'), secondId = viewerComponentId('acme/second', 'api')
  const callerId = 'caller'
  assert.equal(new Set(result.map(item => item.id)).size, 3)
  assert.deepEqual(result.find(item => item.id === callerId)?.dependsOn, [secondId, 'api'],
    'the qualified dependency resolves and the ambiguous bare dependency remains unresolved')
  const graph = runtimeSystemGraph(result)
  assert.deepEqual(graph.edges, [{ from: callerId, to: secondId }])
  assert.deepEqual(source[2].dependsOn, caller.dependsOn, 'the adapter must not mutate stored components')
  assert.ok(result.some(item => item.id === firstId))
  assert.equal(selectViewerComponentId(result, 'acme/second', 'api'), secondId)
})

test('same-repository parents and qualified flow dependencies survive duplicate local IDs', () => {
  const parentA = component('service', 'acme/a')
  const parentB = component('service', 'acme/b')
  const child = component('worker', 'acme/a', {
    parentId: 'service',
    dependsOn: ['database'],
    executionFlows: [{ id: 'request', name: 'Request', summary: 'Call service', sourceRevision: 'a'.repeat(40),
      entryStepId: 'call', steps: [{ id: 'call', title: 'Call', kind: 'dependency', description: '', evidence: [],
        dependencyIds: [{ repository: 'acme/b', component: 'service' }, 'service'] }], transitions: [], gaps: [] }],
  })
  const db = component('database', undefined, { kind: 'database' })
  const result = qualifyViewerComponents([parentA, parentB, child, db], 'acme/home')
  const viewerChild = result.find(item => item.id === 'worker')!
  assert.equal(viewerChild.parentId, viewerComponentId('acme/a', 'service'))
  assert.deepEqual(viewerChild.dependsOn, ['database'])
  assert.deepEqual(viewerChild.executionFlows?.[0].steps[0].dependencyIds,
    [viewerComponentId('acme/b', 'service'), 'service'])
  assert.equal(child.parentId, 'service')
})

test('resolved catalog replaces only the matching qualified home component', () => {
  const home = [component('api', 'acme/a', { name: 'Old A' }), component('api', 'acme/b', { name: 'B' })]
  const result = qualifyViewerComponents(home, 'acme/home', [component('api', 'acme/a', { name: 'Resolved A' })])
  assert.equal(result.length, 2)
  assert.equal(result.find(item => item.id === viewerComponentId('acme/a', 'api'))?.name, 'Resolved A')
  assert.equal(result.find(item => item.id === viewerComponentId('acme/b', 'api'))?.name, 'B')
  assert.deepEqual(home.map(item => item.name), ['Old A', 'B'])
})

test('missing and ambiguous parent and dependency references stay unresolved', () => {
  const result = qualifyViewerComponents([
    component('a', 'acme/a'), component('a', 'acme/b'),
    component('child', 'acme/c', {
      parentId: 'a', dependsOn: ['a', { repository: 'acme/missing', component: 'a' }],
    }),
  ], 'acme/home')
  const child = result.find(item => item.id === 'child')!
  assert.equal(child.parentId, 'a')
  assert.deepEqual(child.dependsOn, ['a', { repository: 'acme/missing', component: 'a' }])
})

test('globally unique IDs and their links retain the legacy viewer shape', () => {
  const result = qualifyViewerComponents([
    component('api', 'acme/api', { dependsOn: ['db'] }),
    component('db', 'acme/home', { kind: 'database' }),
  ], 'acme/home')
  assert.deepEqual(result.map(item => item.id), ['api', 'db'])
  assert.deepEqual(result[0].dependsOn, ['db'])
  assert.equal(selectViewerComponentId(result, 'acme/api', 'api'), 'api')
  assert.deepEqual(runtimeSystemGraph(result).edges, [{ from: 'api', to: 'db' }])
})
