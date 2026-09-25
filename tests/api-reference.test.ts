import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contractKind, contractResource, contractNotes, groupContracts, apiOperations, apiProvider } from '../shared/api-reference.ts'
import type { ApiContract } from '../shared/spec.ts'
const c = (id: string, method: ApiContract['method'], path: string, from = 'app'): ApiContract => ({ id, method, path, name: `${method} ${path}`,
  from, to: 'core', change: 'unspecified' })

test('groups HTTP operations by resource and exact endpoint without merging caller variants', () => {
  const input = [
    c('update-ml', 'PATCH', '/meetings/{id}', 'ml'), c('list', 'GET', '/meetings'), c('update-app', 'PATCH', '/meetings/{id}'),
    c('create', 'POST', '/meetings'), c('task', 'GET', '/tasks'),
  ]
  const groups = groupContracts(input)
  assert.deepEqual(groups.map(g => g.name), ['Meetings', 'Tasks'])
  assert.equal(groups[0].endpoints.length, 2)
  assert.deepEqual(groups[0].endpoints[0].contracts.map(c => c.method), ['GET', 'POST'])
  assert.equal(groups[0].endpoints[1].contracts.length, 2)
  assert.equal(groups.flatMap(g => g.endpoints.flatMap(e => e.contracts)).length, input.length)
  assert.equal(input[0].id, 'update-ml')
})
test('separates message and RPC contracts without claiming a transport', () => {
  assert.equal(contractKind(c('event', 'EVENT', 'com.example.recording.started.v1')), 'messages')
  assert.equal(contractKind(c('rpc', 'RPC', 'start')), 'other')
  assert.equal(contractKind(c('unknown', undefined, '/start')), 'other')
  assert.equal(contractResource(c('versioned', 'GET', '/v2/meetings/{id}')), 'Meetings')
  assert.equal(contractResource({ ...c('audio', 'EVENT', 'audio'), note: 'Source: tdd/contracts/audio.mdx — Audio frame.' }), 'Audio')
})
test('extracts imported facts without truncating parameter values or behavior', () => {
  const note = 'Read a compact meeting list. Auth: bearerAuth; Response: 200 MeetingList; Query params: expand (transcript, tasks), limit '
    + 'Source: tdd/contracts/meeting.mdx — GET /meetings. Target contract; change against the current implementation has not been assessed.'
  const parsed = contractNotes(note)
  assert.equal(parsed.description, 'Read a compact meeting list.')
  assert.deepEqual(parsed.facts, [{ label: 'Auth', value: 'bearerAuth' }, { label: 'Response', value: '200 MeetingList' },
    { label: 'Query params', value: 'expand (transcript, tasks), limit' }])
  assert.match(parsed.source!, /^tdd\/contracts\/meeting.mdx/)
  assert.equal(contractNotes('A payload with no metadata.').description, 'A payload with no metadata.')
  assert.deepEqual(contractNotes().facts, [])
})

test('one provider operation retains all caller-specific contracts and their deep-link IDs', () => {
  const app = c('app-access', 'PATCH', '/meetings/{id}')
  const ml = { ...c('ml-access', 'PATCH', '/meetings/{id}', 'ml'), request: '{"headline":"Result"}' }
  const anotherProvider = { ...app, id: 'other-provider', to: 'another-service' }
  const ops = apiOperations([app, ml, anotherProvider])
  assert.equal(ops.length, 2)
  assert.equal(ops[0].provider, 'core')
  assert.deepEqual(ops[0].records.map(c => c.id), ['app-access', 'ml-access'])
  assert.equal(ops[0].records[1].request, ml.request)
  assert.equal(apiProvider(app), 'core')
  assert.equal(apiProvider({ ...app, method: 'EVENT' }), 'app')
})
test('conflicting change assessments remain visible instead of inferring one status', () => {
  const source = c('app-access', 'PATCH', '/meetings/{id}')
  assert.equal(apiOperations([source, { ...source, id: 'ml-access', change: 'added' }])[0].change, 'mixed')
  assert.equal(apiOperations([{ ...source, change: 'updated' }, { ...source, id: 'ml-access', change: 'updated' }])[0].change, 'updated')
})
