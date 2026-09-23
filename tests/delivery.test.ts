import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { deliverySchema, validateDelivery, deliveryGaps, validationResult } from '../src/data/delivery.ts'
import { parseDelivery } from '../src/data/delivery-legacy.ts'
import { parsePlan } from '../server/format.ts'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { operate } from '../server/operations.ts'
import { serve } from '../server/http.ts'

const files = {
  'project.json': JSON.stringify({ schemaVersion: 2, id: 'project', name: 'Test' }),
  'products/app.json': JSON.stringify({ id: 'app', name: 'App', slug: 'app', kind: 'service-system' }),
  'components/ui.json': JSON.stringify({ id: 'ui', name: 'UI', productId: 'app' }),
  'components/api.json': JSON.stringify({ id: 'api', name: 'API', productId: 'app' }),
  'components/db.json': JSON.stringify({ id: 'db', name: 'Database', productId: 'app' }),
  'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
  'features/f/feature.json': JSON.stringify({ id: 'f', title: 'A feature', productId: 'app', ownerId: 'owner', stage: 'building', touches: ['api', 'ui'], updatedAt: '2026-09-06T00:00:00Z' }),
  'features/f/api.json': JSON.stringify({ contracts: [{ id: 'save', name: 'Save', from: 'ui', to: 'api', path: '/items', method: 'POST', change: 'added' }] }),
  'features/f/tests.json': JSON.stringify({ cases: [{ id: 'journey', title: 'User saves an item', given: 'A new item', when: 'The user saves it', then: ['It survives a reload'], status: 'passing' }, { id: 'boundary', title: 'API persists the item', given: 'A valid request', when: 'POST /items', then: ['Database contains the item'], contracts: ['save'], status: 'passing' }] }),
}
function sample() {
  return deliverySchema.parse({
    deliverables: [{ id: 'm1', title: 'Save an item', outcome: 'The user can save and retrieve an item', componentIds: ['ui', 'api'], status: 'done', acceptance: ['The item survives a reload'] }],
    tasks: [{ id: 's1', deliverableId: 'm1', componentId: 'api', title: 'API persistence', summary: 'A saved item can be read back through the API.', scope: ['Persist requests through the API'], contractIds: ['save'], status: 'done', acceptance: ['The API writes and reads the record'] }],
    validation: [
      { id: 'e2e', level: 'end-to-end', deliverableId: 'm1', title: 'Full save journey', testIds: ['journey'], file: 'tests/save-e2e.ts', command: 'npm run test:e2e', entryPoint: 'Browser save form', environment: 'UI, API and Postgres', realDependencyIds: ['ui', 'api', 'db'] },
      { id: 'service', level: 'component-integration', taskId: 's1', title: 'API boundary', testIds: ['boundary'], file: 'tests/save-service.ts', command: 'npm run test:service', entryPoint: 'POST /items', environment: 'Real API with containerised Postgres', realDependencyIds: ['api', 'db'] },
    ],
  })
}
const snapshot = parsePlan(files).snapshot
const proof = (validationId: string, result: 'passed' | 'failed', time = '2026-09-06T01:00:00Z') => ({ id: `${validationId}-${result}`, validationId, result, description: 'Observed run', recordedAt: time, reference: 'artifacts/run.json', testedRevision: 'abc123', environment: 'Local test stack' })

test('a deliverable groups owned component tasks and separates two levels of proof', () => {
  const plan = sample()
  assert.doesNotThrow(() => validateDelivery('f', plan, snapshot))
  assert.ok(deliveryGaps(plan, plan.deliverables[0]).some(gap => gap.includes('passing run')))
  // Tests marked passing in the specification alone do not establish delivery proof.
  assert.equal(validationResult(plan, plan.validation[0]).result, 'unverified')
  plan.evidence.push(proof('service', 'passed'))
  assert.deepEqual(deliveryGaps(plan, plan.tasks[0]), [])
  assert.ok(deliveryGaps(plan, plan.deliverables[0]).length)
  plan.evidence.push(proof('e2e', 'passed'))
  assert.deepEqual(deliveryGaps(plan, plan.deliverables[0]), [])
  plan.evidence.push(proof('service', 'failed', '2026-09-06T02:00:00Z'))
  assert.ok(deliveryGaps(plan, plan.deliverables[0]).some(gap => gap.includes('task not complete')))
})
test('unit tests cannot stand in for honeycomb component integration tests', () => {
  const plan = sample()
  plan.validation[1] = { ...plan.validation[1], level: 'unit', taskId: 's1' }
  plan.evidence.push(proof('service', 'passed'), proof('e2e', 'passed'))
  assert.ok(deliveryGaps(plan, plan.tasks[0]).includes('Plan component integration tests'))
})
test('component ownership, API boundaries, scenario references and test topology are validated', () => {
  for (const [edit, message] of [
    [(p: ReturnType<typeof sample>) => { p.tasks[0].componentId = 'missing' }, /unknown component/],
    [(p: ReturnType<typeof sample>) => { p.tasks[0].componentId = 'db' }, /component chain/],
    [(p: ReturnType<typeof sample>) => { p.deliverables[0].componentIds.push('db'); p.tasks[0].componentId = 'db' }, /contract save/],
    [(p: ReturnType<typeof sample>) => { p.validation[0].testIds = ['missing'] }, /unknown test/],
    [(p: ReturnType<typeof sample>) => { p.validation[1].substitutedDependencyIds = ['api'] }, /both real and substituted/],
    [(p: ReturnType<typeof sample>) => { p.tasks[0].deliverableId = 'missing' }, /unknown deliverable/],
    [(p: ReturnType<typeof sample>) => { p.evidence.push({ ...proof('e2e', 'passed'), taskId: 's1' }) }, /evidence must belong/],
  ] as const) { const plan = sample(); edit(plan); assert.throws(() => validateDelivery('f', plan, snapshot), message) }
})
test('implicit deliverable completion dependencies cannot deadlock tasks', () => {
  const plan = sample()
  plan.tasks[0].dependsOn = ['m1']
  assert.throws(() => validateDelivery('f', plan, snapshot), /own deliverable/)
  plan.tasks[0].dependsOn = ['m2']
  plan.deliverables.push({ ...plan.deliverables[0], id: 'm2', dependsOn: ['m1'] })
  assert.throws(() => validateDelivery('f', plan, snapshot), /scheduling cycle/)
})
test('passing reports need provenance and conflicting latest reports fail closed', () => {
  const plan = sample()
  plan.evidence.push({ ...proof('service', 'passed'), testedRevision: undefined })
  assert.ok(deliveryGaps(plan, plan.tasks[0]).some(gap => gap.includes('tested revision')))
  plan.evidence.push(proof('service', 'failed'))
  assert.equal(validationResult(plan, plan.validation[1]).result, 'failed')
})
test('old task records stay readable and remain visibly undecomposed', () => {
  const plan = parseDelivery({ milestones: [{ id: 'm', title: 'Old milestone', status: 'done' }], tasks: [{ id: 't', milestoneId: 'm', title: 'Old task', status: 'done' }], branches: [{ branch: 'main', taskId: 't' }], evidence: [{ ...proof('unused', 'passed'), validationId: undefined, taskId: 't' }] })
  validateDelivery('f', plan, snapshot)
  assert.equal(plan.undecomposedTasks.length, 1)
  assert.equal(plan.tasks.length, 0)
  assert.equal(plan.branches[0].legacyTaskId, 't')
  assert.equal(plan.evidence[0].legacyTaskId, 't')
  assert.ok(deliveryGaps(plan, plan.deliverables[0]).includes('Divide the deliverable into component tasks'))
  assert.deepEqual(parseDelivery(plan), plan)
})
test('existing milestone and slice documents retain identity, dependencies and proof on read', () => {
  const canonical = sample()
  delete canonical.tasks[0].summary
  canonical.branches.push({ branch: 'main', taskId: 's1' })
  canonical.evidence.push({ ...proof('service', 'passed'), taskId: 's1' })
  const legacy = {
    milestones: canonical.deliverables,
    slices: canonical.tasks.map(({ deliverableId, ...task }) => ({ ...task, milestoneId: deliverableId })),
    tasks: [],
    validation: canonical.validation.map(v => v.level === 'end-to-end' ? { ...v, deliverableId: undefined, milestoneId: v.deliverableId } : { ...v, taskId: undefined, sliceId: v.taskId }),
    branches: [{ branch: 'main', sliceId: 's1' }],
    evidence: canonical.evidence.map(({ taskId, ...e }) => ({ ...e, sliceId: taskId })),
  }
  const source = JSON.stringify(legacy)
  const plan = parsePlan({ ...files, 'features/f/delivery.json': source }).delivery.f
  assert.deepEqual(plan, canonical)
  assert.deepEqual(deliveryGaps(plan, plan.tasks[0]), [])
  assert.ok(deliveryGaps(plan, plan.deliverables[0]).length)
  assert.throws(() => parseDelivery({ ...legacy, deliverables: [] }), /Unrecognized/)
  assert.throws(() => deliverySchema.parse(JSON.parse(source)), /Unrecognized/)
})
test('HTTP delivery authoring persists tasks, checks boundaries, and records validation evidence', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-delivery-')); t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { files })
  const server = await serve({ root, port: 0 }); t.after(() => server.close())
  const { token } = await (await fetch(server.url + '/api/session')).json() as { token: string }
  const post = async (operation: string, args: Record<string, unknown>) => {
    const current = await readPlan(root)
    return fetch(server.url + '/api/operations/' + operation, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...args, expectedRevision: current.revision, expectedContext: current.context.token }) })
  }
  assert.equal((await post('plan_delivery', { featureId: 'f', delivery: sample() })).status, 200)
  assert.equal((await readPlan(root)).delivery.f.tasks[0].componentId, 'api')
  assert.equal((await readPlan(root)).delivery.f.tasks[0].summary, 'A saved item can be read back through the API.')
  const stored = JSON.parse((await readPlan(root)).files['features/f/delivery.json'])
  assert.equal(stored.tasks[0].deliverableId, 'm1')
  assert.equal('milestones' in stored || 'slices' in stored, false)
  const bad = sample(); bad.tasks[0].contractIds = ['nonexistent']
  assert.equal((await post('plan_delivery', { featureId: 'f', delivery: bad })).status, 400)
  const current = await readPlan(root)
  await operate('record_progress', { featureId: 'f', unitId: 's1', status: 'done', evidence: proof('service', 'passed'), expectedRevision: current.revision, expectedContext: current.context.token }, root)
  const after = await readPlan(root)
  assert.deepEqual(deliveryGaps(after.delivery.f, after.delivery.f.tasks[0]), [])
  assert.ok(deliveryGaps(after.delivery.f, after.delivery.f.deliverables[0]).length)
})

test('updating an old plan writes canonical names and preserves undecomposed work', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-delivery-migration-')); t.after(() => rm(root, { recursive: true, force: true }))
  const source = JSON.stringify({ milestones: [{ id: 'm', title: 'Old milestone', status: 'planned' }], tasks: [{ id: 't', milestoneId: 'm', title: 'Old task', status: 'planned' }], branches: [{ branch: 'main', taskId: 't' }] })
  await initialise(root, { files: { ...files, 'features/f/delivery.json': source } })
  const before = await readPlan(root)
  assert.equal(before.files['features/f/delivery.json'], source)
  await operate('record_progress', { featureId: 'f', unitId: 't', status: 'in-progress', expectedRevision: before.revision, expectedContext: before.context.token }, root)
  const after = await readPlan(root)
  const stored = JSON.parse(after.files['features/f/delivery.json'])
  assert.equal('milestones' in stored || 'slices' in stored, false)
  assert.equal(stored.deliverables[0].id, 'm')
  assert.equal(stored.tasks.length, 0)
  assert.equal(stored.undecomposedTasks[0].status, 'in-progress')
  assert.equal(stored.branches[0].legacyTaskId, 't')
})
test('delivery text is validated like content text: blanks are rejected and values are never rewritten', () => {
  const plan = deliverySchema.parse({ deliverables: [{ id: 'm1', title: '  padded  ', status: 'planned' }] })
  assert.equal(plan.deliverables[0].title, '  padded  ')
  assert.throws(() => deliverySchema.parse({ deliverables: [{ id: 'm1', title: '   ', status: 'planned' }] }), /blank/)
  assert.throws(() => deliverySchema.parse({ deliverables: [{ id: 'toString', title: 'T', status: 'planned', dependsOn: [''] }] }))
})
test('delivery gaps stay linear on diamond-shaped plans and terminate on unvalidated cycles', () => {
  const units = Array.from({ length: 40 }, (_, i) => ({
    id: `u${i}`, deliverableId: 'm', componentId: 'api', title: `Task ${i}`, status: 'done',
    // Every task depends on the two before it: naive recursion would take ~1.6^40 calls.
    dependsOn: i > 1 ? [`u${i - 1}`, `u${i - 2}`] : [],
  }))
  const plan = deliverySchema.parse({ deliverables: [{ id: 'm', title: 'M', status: 'planned' }], tasks: units })
  const started = performance.now()
  assert.ok(deliveryGaps(plan, plan.tasks.at(-1)!).length)
  assert.ok(performance.now() - started < 1000)
  const cyclic = deliverySchema.parse({
    deliverables: [{ id: 'a', title: 'A', status: 'done', dependsOn: ['b'] }, { id: 'b', title: 'B', status: 'done', dependsOn: ['a'] }],
  })
  assert.ok(deliveryGaps(cyclic, cyclic.deliverables[0]).includes('Dependency b is not complete with validation'))
})
