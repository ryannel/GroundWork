import { test } from 'node:test'
import assert from 'node:assert/strict'
import { componentSchema } from '../src/data/content-schema.ts'
import { executionFlowIssues, sourceEvidenceUrl } from '../src/data/execution-flow.ts'
import type { Component } from '../src/data/model.ts'
const revision = 'a'.repeat(40)
const evidence = [{ path: 'Api/Upload.cs', lines: '10-20', claim: 'Stores an uploaded file before returning.', revision }]
const fixture = (): Component => componentSchema.parse({
  id: 'facade', productId: 'product', name: 'Facade', order: 0,
  api: { name: 'Facade API', endpoints: [{ id: 'upload', name: 'Upload', method: 'POST', path: '/upload' }] },
  data: { records: [{ id: 'blob', name: 'Uploaded data', kind: 'document', fields: [] }] },
  executionFlows: [{ id: 'upload-flow', endpointId: 'upload', name: 'Upload data', summary: 'Upload and store data.', sourceRevision: revision, entryStepId: 'receive', gaps: ['Infrastructure policy is not traced.'], steps: [
    { id: 'receive', title: 'Receive upload', kind: 'request', description: 'Receives the request.', evidence },
    { id: 'store', title: 'Store blob', kind: 'data', description: 'Stores the upload.', dataRecordIds: ['blob'], evidence },
  ], transitions: [{ id: 'save', from: 'receive', to: 'store', label: 'Valid request', mode: 'sync', evidence }] }],
})
test('execution flows link to catalog records and retain a pinned source revision', () => {
  const component = fixture()
  assert.deepEqual(executionFlowIssues(component), [])
  assert.equal(sourceEvidenceUrl('example/catalogue-gateway', evidence[0]), `https://github.com/example/catalogue-gateway/blob/${revision}/Api/Upload.cs#L10-L20`)
  assert.equal(sourceEvidenceUrl('https://example.com/repo', evidence[0]), undefined)
})
test('execution flows reject dangling catalog references and broken graph boundaries', () => {
  const component = fixture(), flow = component.executionFlows![0]
  flow.endpointId = 'missing'
  flow.steps[1].dataRecordIds = ['missing']
  flow.steps[1].messageIds = ['missing']
  flow.steps[1].dependencyIds = ['missing']
  flow.steps[1].unresolvedDependencyNames = ['missing']
  flow.transitions[0].to = 'outside'
  const issues = executionFlowIssues(component).join('\n')
  for (const fragment of ['unknown endpoint', 'unknown data record', 'unknown message', 'unknown dependency', 'unknown unresolved dependency', 'transition leaves', 'unreachable']) assert.match(issues, new RegExp(fragment))
})
test('execution flow evidence must use the flow revision and valid repository-relative ranges', () => {
  const component = fixture(), flow = component.executionFlows![0]
  flow.steps[0].evidence = [{ ...evidence[0], revision: 'b'.repeat(40), path: '../other.cs', lines: '20-10' }]
  const issues = executionFlowIssues(component).join('\n')
  assert.match(issues, /evidence revision differs/)
  assert.match(issues, /repository-relative/)
  assert.match(issues, /invalid evidence line range/)
  flow.steps[0].evidence = []
  assert.equal(componentSchema.safeParse(component).success, false)
})
test('cycles terminate during validation, while duplicate identities are rejected', () => {
  const component = fixture(), flow = component.executionFlows![0]
  flow.transitions.push({ id: 'retry', from: 'store', to: 'receive', label: 'Retry', mode: 'sync', evidence })
  assert.deepEqual(executionFlowIssues(component), [])
  flow.steps.push({ ...flow.steps[0] })
  assert.match(executionFlowIssues(component).join('\n'), /duplicate.*step IDs/)
})

test('consumer and job flows use owned non-HTTP triggers without fabricating endpoints', () => {
  const component = fixture(), flow = component.executionFlows![0]
  delete flow.endpointId
  component.messaging = { messages: [{ id: 'updated', name: 'Updated', broker: 'Kafka', channel: 'updates', direction: 'inbound', fields: [], delivery: { ordering: 'Unknown', retries: 'Unknown', deadLetter: 'Unknown' } }] }
  flow.trigger = { kind: 'message', messageId: 'updated' }
  assert.deepEqual(executionFlowIssues(component), [])
  component.messaging.messages[0].direction = 'outbound'
  assert.match(executionFlowIssues(component).join('\n'), /inbound message/)
  component.jobs = [{ id: 'refresh', name: 'Refresh', description: 'Refreshes the cache.', evidence }]
  flow.trigger = { kind: 'job', jobId: 'refresh' }
  assert.deepEqual(executionFlowIssues(component), [])
  flow.endpointId = 'upload'
  assert.match(executionFlowIssues(component).join('\n'), /exactly one/)
  delete flow.endpointId; delete flow.trigger
  assert.match(executionFlowIssues(component).join('\n'), /exactly one/)
})
