import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { operate } from '../server/operations.ts'
import { queryCatalog } from '../server/catalog.ts'
import { readPlan } from '../server/repository.ts'
import { initialise } from '../server/setup.ts'

async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(process.cwd(), '.operations-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { name: 'Test app' })
  return root
}

test('operation parsing preserves query defaults, trims input and rejects unexpected fields', async t => {
  const root = await fixture(t)
  const plan = await readPlan(root)
  assert.deepEqual(await operate('search_catalog', { query: '   ' }, root), queryCatalog(plan, 'search_catalog', { query: '' }))
  assert.deepEqual(await operate('get_discovery_context', { question: 'app' }, root), queryCatalog(plan, 'get_discovery_context', { question: 'app' }))
  await assert.rejects(operate('search_catalog', { query: '', expectedRevision: plan.revision }, root), /Unrecognized key/)
  await assert.rejects(operate('record_progress', { featureId: 'f', stage: 'invalid' }, root), /Invalid option/)
})

test('write and progress dispatch preserve typed payloads and reject committed-ref edits', async t => {
  const root = await fixture(t)
  const before = await readPlan(root)
  const guard = (plan: typeof before) => ({ expectedRevision: plan.revision, expectedContext: plan.context.token })
  await assert.rejects(operate('create_feature', {
    ...guard(before), ref: 'main', id: 'f', title: 'Feature', productId: 'app', ownerId: 'owner', problem: 'Problem', outcome: 'Outcome',
  }, root), /read-only/)
  await operate('create_feature', {
    ...guard(before), id: 'f', title: 'Feature', productId: 'app', ownerId: 'owner', problem: 'Problem', outcome: 'Outcome',
  }, root)
  const created = await readPlan(root)
  assert.equal(created.snapshot.features[0].stage, 'idea')
  await operate('record_progress', { ...guard(created), featureId: 'f', stage: 'exploring' }, root)
  const updated = await readPlan(root)
  assert.equal(updated.snapshot.features[0].stage, 'exploring')
  assert.deepEqual(updated.delivery.f.branches, [])
  await operate('write_plan', {
    ...guard(updated), changes: { 'members/owner.json': JSON.stringify({ id: 'owner', name: 'Updated owner' }) },
  }, root)
  assert.equal((await readPlan(root)).snapshot.members[0].name, 'Updated owner')
})
