import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverySchema, validateDelivery, deliveryGaps, validationResult } from '../shared/delivery.ts'
import { parsePlan } from '../server/format.ts'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { operate } from '../server/operations.ts'
import { serve } from '../server/http.ts'
import { register } from '../server/registry.ts'
import { git, context } from '../server/git.ts'
import path from 'node:path'
import { gitInit, guard, tempDir, withEnv } from './helpers.ts'

const files = {
  'products/app.json': JSON.stringify({ id: 'app', name: 'App', slug: 'app', kind: 'service-system', repositories: [{ repository: 'acme/delivery',
    role: 'owned' }] }),
  'components/ui.json': JSON.stringify({ id: 'ui', name: 'UI', repo: 'acme/delivery' }),
  'components/api.json': JSON.stringify({ id: 'api', name: 'API', repo: 'acme/delivery' }),
  'components/db.json': JSON.stringify({ id: 'db', name: 'Database', repo: 'acme/delivery' }),
  'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
  'features/f/feature.json': JSON.stringify({
    id: 'f', title: 'A feature', productId: 'app', ownerId: 'owner', stage: 'building', touches: ['api', 'ui'], updatedAt: '2026-09-06T00:00:00Z',
  }),
  'features/f/api.json': JSON.stringify({ contracts: [{ id: 'save', name: 'Save', from: 'ui', to: 'api', path: '/items', method: 'POST', change: 'added' }] }),
  'features/f/tests.json': JSON.stringify({ cases: [
    { id: 'journey', title: 'User saves an item', given: 'A new item', when: 'The user saves it', then: ['It survives a reload'], status: 'passing' },
    {
      id: 'boundary', title: 'API persists the item', given: 'A valid request', when: 'POST /items', then: ['Database contains the item'],
      contracts: ['save'], status: 'passing',
    },
  ] }),
}
function sample() {
  return deliverySchema.parse({
    deliverables: [{
      id: 'm1', title: 'Save an item', outcome: 'The user can save and retrieve an item', componentIds: ['ui', 'api'], status: 'done',
      acceptance: ['The item survives a reload'],
    }],
    tasks: [{
      id: 's1', deliverableId: 'm1', componentId: 'api', title: 'API persistence', summary: 'A saved item can be read back through the API.',
      scope: ['Persist requests through the API'], contractIds: ['save'], status: 'done', acceptance: ['The API writes and reads the record'],
    }],
    validation: [
      {
        id: 'e2e', level: 'end-to-end', deliverableId: 'm1', title: 'Full save journey', testIds: ['journey'], file: 'tests/save-e2e.ts',
        command: 'npm run test:e2e', entryPoint: 'Browser save form', environment: 'UI, API and Postgres', realDependencyIds: ['ui', 'api', 'db'],
      },
      {
        id: 'service', level: 'component-integration', taskId: 's1', title: 'API boundary', testIds: ['boundary'], file: 'tests/save-service.ts',
        command: 'npm run test:service', entryPoint: 'POST /items', environment: 'Real API with containerised Postgres',
        realDependencyIds: ['api', 'db'],
      },
    ],
  })
}
const snapshot = parsePlan(files, { repository: { id: 'acme/delivery', origin: 'git@github.com:acme/delivery.git', provisional: false } }).snapshot
const proof = (validationId: string, result: 'passed' | 'failed', time = '2026-09-06T01:00:00Z') => ({
  id: `${validationId}-${result}`, validationId, result, description: 'Observed run', recordedAt: time, reference: 'artifacts/run.json',
  testedRevision: 'abc123', environment: 'Local test stack',
})

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
    [(p: ReturnType<typeof sample>) => { p.deliverables[0].componentIds.push('db');
      p.tasks[0].componentId = 'db' }, /contract save/],
    [(p: ReturnType<typeof sample>) => { p.validation[0].testIds = ['missing'] }, /unknown test/],
    [(p: ReturnType<typeof sample>) => { p.validation[1].substitutedDependencyIds = ['api'] }, /both real and substituted/],
    [(p: ReturnType<typeof sample>) => { p.tasks[0].deliverableId = 'missing' }, /unknown deliverable/],
    [(p: ReturnType<typeof sample>) => { p.evidence.push({ ...proof('e2e', 'passed'), taskId: 's1' }) }, /evidence must belong/],
  ] as const) { const plan = sample();
    edit(plan);
    assert.throws(() => validateDelivery('f', plan, snapshot), message) }
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
test('HTTP delivery authoring persists tasks, checks boundaries, and records validation evidence', async t => {
  const root = await tempDir(t, 'groundwork-delivery-')
  withEnv(t, { GROUNDWORK_HOME: path.join(root, 'config') })
  await gitInit(root)
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/delivery.git'])
  await initialise(root, { files })
  await register(root)
  const checkoutId = (await context(root)).checkoutId
  const server = await serve({ port: 0 });
  t.after(() => server.close())
  const { token } = await (await fetch(server.url + '/api/session')).json() as { token: string }
  const post = async (operation: string, args: Record<string, unknown>) => {
    const current = await readPlan(root)
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    return fetch(server.url + '/api/operations/' + operation, { method: 'POST', headers, body: JSON.stringify({ checkoutId, ...args, ...guard(current) }) })
  }
  assert.equal((await post('plan_delivery', { featureId: 'f', delivery: sample() })).status, 200)
  assert.equal((await readPlan(root)).delivery.f.tasks[0].componentId, 'api')
  assert.equal((await readPlan(root)).delivery.f.tasks[0].summary, 'A saved item can be read back through the API.')
  const stored = JSON.parse((await readPlan(root)).files['features/f/delivery.json'])
  assert.equal(stored.tasks[0].deliverableId, 'm1')
  assert.equal('milestones' in stored || 'slices' in stored, false)
  const bad = sample();
  bad.tasks[0].contractIds = ['nonexistent']
  assert.equal((await post('plan_delivery', { featureId: 'f', delivery: bad })).status, 400)
  const current = await readPlan(root)
  await operate('record_progress', { featureId: 'f', unitId: 's1', status: 'done', evidence: proof('service', 'passed'), ...guard(current) }, root)
  const after = await readPlan(root)
  assert.deepEqual(deliveryGaps(after.delivery.f, after.delivery.f.tasks[0]), [])
  assert.ok(deliveryGaps(after.delivery.f, after.delivery.f.deliverables[0]).length)
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
