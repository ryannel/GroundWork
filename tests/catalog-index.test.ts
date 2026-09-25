import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogIndex } from '../shared/catalog-index.ts'
import { catalogId } from '../shared/catalog-identity.ts'
import type { Component } from '../shared/model.ts'

const id = (kind: Parameters<typeof catalogId>[2], entity: string) => catalogId('acme/api', 'api', kind, entity)
function component(overrides: Record<string, unknown> = {}): Component {
  return {
    id: 'api', order: 0, name: 'API', repo: 'acme/api', description: 'Service',
    api: {
      name: 'API',
      endpoints: [{ id: 'get-user', name: 'Get user', method: 'GET', path: '/users/{id}', summary: 'Read a user', response: 'User' }],
      schemas: [{ id: 'user', name: 'User', description: 'A user' }],
    },
    data: { records: [{ id: 'users', name: 'users', description: 'User table' }] },
    jobs: [{ id: 'nightly', name: 'Nightly', description: 'Batch' }],
    executionFlows: [{
      id: 'read-user', name: 'Read user', summary: 'Reads a user', endpointId: 'get-user', gaps: [],
      steps: [{ id: 'a', title: 'Load', dataRecordIds: ['users'], evidence: [] }, { id: 'b', title: 'Reload', dataRecordIds: ['users'], evidence: [] }],
    }],
    ...overrides,
  } as unknown as Component
}
const index = (value = component()) => new Map(catalogIndex({ manifest: { id: 'p' }, snapshot: { components: [value] } }).map(entry => [entry.id, entry]))

test('reverse links come only from forward links and are never reversed again', () => {
  const entries = index()
  const endpoint = entries.get(id('endpoint', 'get-user'))!
  const schema = entries.get(id('schema', 'user'))!
  assert.deepEqual(endpoint.related.map(relation => [relation.id, relation.kind, relation.reverse]), [
    [id('component', 'api'), 'owner', false],
    [id('schema', 'user'), 'contract', false],
    [id('flow', 'read-user'), 'trace', false],
  ], 'the flow trigger is not mirrored because the endpoint already links to the flow, and nothing says "Referenced by schema"')
  assert.ok(!endpoint.related.some(relation => relation.reason.startsWith('Referenced by schema')))
  assert.deepEqual(schema.related.filter(relation => relation.reverse).map(relation => [relation.id, relation.kind]), [[endpoint.id, 'contract']])
})

test('relations are deduplicated by target, kind and direction', () => {
  const entries = index()
  const flow = entries.get(id('flow', 'read-user'))!
  const record = entries.get(id('data', 'users'))!
  assert.equal(flow.related.filter(relation => relation.id === record.id).length, 1)
  assert.deepEqual(record.related.map(relation => relation.reason), ['Owned by component', 'Referenced by flow: Read user'])
})
