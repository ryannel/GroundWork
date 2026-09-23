import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogIndex } from '../src/data/catalog-index.ts'
import { catalogId } from '../src/data/catalog-identity.ts'
import { baselineAssessments, componentObservation, entityObservation, knowledgeBaselineSchema } from '../src/data/knowledge.ts'
import type { Component } from '../src/data/model.ts'

const id = (kind: Parameters<typeof catalogId>[2], entity: string) => catalogId('p', 'api', kind, entity)
function component(overrides: Record<string, unknown> = {}): Component {
  return {
    id: 'api', productId: 'app', order: 0, name: 'API', repo: 'acme/api', description: 'Service',
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

test('component observations exclude every child inventory, including jobs', () => {
  const observation = componentObservation(component())
  for (const key of ['api', 'data', 'messaging', 'executionFlows', 'findings', 'jobs']) assert.equal(key in observation, false, key)
  assert.equal(observation.name, 'API')
})

test('baseline comparison uses typed relations and ignores key order and relation text', () => {
  const entries = index()
  const retain = (ids: string[]) => knowledgeBaselineSchema.parse({
    version: 1, featureId: 'f', question: 'Q', catalogRevision: 'a'.repeat(64), context: 'b'.repeat(64), capturedAt: new Date().toISOString(), assumptions: [],
    observations: ids.map(value => entityObservation(entries.get(value)!)),
  })
  const ids = [id('endpoint', 'get-user'), id('component', 'api')]
  const baseline = retain(ids)
  const state = (value: Component, packet = baseline) => baselineAssessments(packet, [value], 'p').map(item => item.catalogState)
  assert.deepEqual(state(component()), ['unchanged', 'unchanged'])

  const reordered = structuredClone(baseline)
  reordered.observations[0].observation = Object.fromEntries(Object.entries(reordered.observations[0].observation).reverse())
  reordered.observations[0].relations = reordered.observations[0].relations.map(relation => ({ ...relation, reason: 'Reworded' })).reverse()
  assert.deepEqual(state(component(), reordered), ['unchanged', 'unchanged'])

  const withoutFlow = component({ executionFlows: [] })
  assert.deepEqual(state(withoutFlow), ['changed', 'unchanged'], 'a lost relation changes the endpoint; child inventory does not change the component')
  assert.deepEqual(state(component({ api: { name: 'API', endpoints: [], schemas: [] } })), ['removed', 'unchanged'])

  const legacy = structuredClone(baseline)
  legacy.observations[0].relations = legacy.observations[0].relations.map(({ id, reason }) => ({ id, reason }))
  assert.deepEqual(state(component(), legacy), ['changed', 'unchanged'], 'baselines retained before typed relations compare as changed')
})
