import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import { get } from 'node:http'
import path from 'node:path'
import { initialise, exportLegacy } from '../server/setup.ts'
import { readPlan, writePlan, recover, Conflict } from '../server/repository.ts'
import { parsePlan, renderBrief, deliverySchema } from '../server/format.ts'
import { operate } from '../server/operations.ts'
import { git, context, discover } from '../server/git.ts'
import { serve } from '../server/http.ts'

async function fixture(t: any, gitRepo = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { name: 'Test app' })
  if (gitRepo) {
    await git(root, ['init', '-b', 'main'])
    await git(root, ['config', 'user.email', 'tests@example.invalid'])
    await git(root, ['config', 'user.name', 'Groundwork tests'])
    await git(root, ['add', '.'])
    await git(root, ['commit', '-m', 'Initial plan'])
  }
  return root
}
async function feature(root: string, id = 'first') {
  const plan = await readPlan(root)
  await operate('create_feature', { id, title: 'First feature', productId: 'app', ownerId: 'owner', problem: 'A user problem', outcome: 'A useful outcome', expectedRevision: plan.revision, expectedContext: plan.context.token }, root)
  return readPlan(root)
}
const request = (plan: Awaited<ReturnType<typeof readPlan>>, changes: Record<string, string | null>) => ({ expectedRevision: plan.revision, expectedContext: plan.context.token, changes })

test('initialisation is portable, keeps existing instructions, and never overwrites plans', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-init-')); t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(path.join(root, 'AGENTS.md'), 'Existing project rules.\n')
  await initialise(root, { name: 'My app', domain: 'https://tellourstory.xyz/' })
  const plan = await readPlan(root)
  assert.equal(plan.manifest.domain, 'https://tellourstory.xyz/')
  assert.equal(plan.snapshot.features.length, 0)
  assert.ok(!Object.values(plan.files).join().includes(root))
  assert.match(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /^Existing project rules/)
  assert.equal(JSON.parse(plan.files['products/app.json']).workspaceId, undefined)
  await assert.rejects(initialise(root), /already exist/)
})
test('briefs round-trip and structured specs keep their cross-reference validation', async t => {
  const root = await fixture(t)
  const plan = await feature(root)
  assert.equal(plan.snapshot.features[0].spec!.purpose!.problem, 'A user problem')
  await assert.rejects(writePlan(root, request(plan, { 'features/first/brief.md': renderBrief({ problem: 'Why', outcome: 'What', success: [{ id: 'result', text: 'Verified', tests: ['missing'] }] }) })), /unknown tests reference/)
  assert.equal((await readPlan(root)).revision, plan.revision)
})
test('transactions reject stale revisions, missing context and malformed candidates without changing disk', async t => {
  const root = await fixture(t), before = await readPlan(root)
  const next = await feature(root)
  await assert.rejects(writePlan(root, request(before, { 'members/owner.json': '{bad' })), /Stale edit/)
  await assert.rejects(writePlan(root, request(next, { 'members/owner.json': '{bad' })), /members\/owner.json/)
  await assert.rejects(writePlan(root, { ...request(next, {}), expectedContext: '' }), /require/)
  assert.equal((await readPlan(root)).revision, next.revision)
})
test('concurrent writers cannot both apply the same revision', async t => {
  const root = await fixture(t), plan = await readPlan(root)
  const results = await Promise.allSettled(['One', 'Two'].map(name => writePlan(root, request(plan, { 'members/owner.json': JSON.stringify({ id: 'owner', name }) }))))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected').length, 1)
  assert.ok(['One', 'Two'].includes((await readPlan(root)).snapshot.members[0].name))
})
test('interrupted writes restore before-images and preserve unrelated external changes', async t => {
  const root = await fixture(t), plan = await readPlan(root)
  const name = 'members/owner.json', after = { ...plan.files, [name]: JSON.stringify({ id: 'owner', name: 'After' }) }
  await writeFile(path.join(root, '.groundwork/transaction.json'), JSON.stringify({ before: plan.files, after, paths: [name] }))
  await writeFile(path.join(root, '.groundwork/plans', name), after[name])
  await assert.rejects(readPlan(root), /recovery is pending/)
  await recover(root)
  assert.equal((await readPlan(root)).revision, plan.revision)
  await writeFile(path.join(root, '.groundwork/transaction.json'), JSON.stringify({ before: plan.files, after, paths: [name] }))
  await writeFile(path.join(root, '.groundwork/plans', name), 'external edit')
  await assert.rejects(recover(root), /Recovery paused/)
  assert.equal(await readFile(path.join(root, '.groundwork/plans', name), 'utf8'), 'external edit')
  assert.ok(await readFile(path.join(root, '.groundwork/transaction.json'), 'utf8'))
})
test('branch switches invalidate context and committed refs stay separate and read-only', async t => {
  const root = await fixture(t, true), before = await readPlan(root)
  await git(root, ['checkout', '-b', 'feature/new'])
  await assert.rejects(writePlan(root, request(before, { 'members/owner.json': JSON.stringify({ id: 'owner', name: 'Wrong branch' }) })), Conflict)
  await feature(root)
  assert.equal((await readPlan(root, 'main')).snapshot.features.length, 0)
  assert.equal((await readPlan(root)).snapshot.features.length, 1)
  assert.equal((await readPlan(root, 'main')).context.editable, false)
  await assert.rejects(operate('write_plan', { ...request(before, {}), ref: 'main' }, root), /read-only/)
  assert.equal((await context(root)).branch, 'feature/new')
})
test('externally created worktrees are discovered and identical IDs remain isolated', async t => {
  const root = await fixture(t, true)
  const worktree = path.join(root, 'other-checkout')
  await git(root, ['worktree', 'add', '-b', 'other', worktree])
  const checkouts = await discover(root)
  assert.equal(checkouts.length, 2)
  assert.notEqual(checkouts[0].checkoutId, checkouts[1].checkoutId)
  await feature(root)
  await feature(worktree)
  const [a, b] = await Promise.all([readPlan(root), readPlan(worktree)])
  assert.equal(a.manifest.id, b.manifest.id)
  assert.equal(a.snapshot.features[0].id, b.snapshot.features[0].id)
  assert.notEqual(a.context.token, b.context.token)
})
test('delivery validates dependencies and recording Git links never declares completion', async t => {
  const root = await fixture(t, true), plan = await feature(root)
  const delivery = deliverySchema.parse({ deliverables: [{ id: 'result', title: 'A useful result', status: 'planned', componentIds: ['api'] }], tasks: [{ id: 'task', deliverableId: 'result', componentId: 'api', title: 'Build it', status: 'planned', acceptance: ['A useful check'] }] })
  await writePlan(root, request(plan, { 'components/api.json': JSON.stringify({ id: 'api', productId: 'app', name: 'API' }), 'features/first/delivery.json': JSON.stringify(delivery) }))
  const next = await readPlan(root)
  await operate('link_branch', { featureId: 'first', taskId: 'task', branch: 'main', expectedRevision: next.revision, expectedContext: next.context.token }, root)
  assert.equal((await readPlan(root)).delivery.first.tasks[0].status, 'planned')
  assert.deepEqual((await readPlan(root)).delivery.first.branches, [{ branch: 'main', taskId: 'task' }])
  delivery.tasks[0].dependsOn = ['task']
  assert.throws(() => parsePlan({ ...next.files, 'features/first/delivery.json': JSON.stringify(delivery) }), /dependency cycle/)
})
test('plan traversal and symlink reads are rejected', async t => {
  const root = await fixture(t), plan = await readPlan(root)
  await assert.rejects(writePlan(root, request(plan, { '../escape.json': '{}' })), /Invalid document/)
  await symlink(path.join(root, 'README.md'), path.join(root, '.groundwork/plans/leak.json'))
  await assert.rejects(readPlan(root), /Symbolic links/)
})
test('HTTP requires authentication and local origin, retains last valid plans, and scopes assets', async t => {
  const root = await fixture(t), plan = await feature(root)
  const app = await serve({ root, port: 0 }); t.after(() => app.close())
  assert.equal((await fetch(app.url + '/api/snapshot')).status, 200)
  const { token } = await (await fetch(app.url + '/api/session')).json()
  const data = request(plan, { 'members/owner.json': JSON.stringify({ id: 'owner', name: 'HTTP owner' }) })
  const post = (headers: Record<string, string>) => fetch(app.url + '/api/operations/write_plan', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) })
  assert.equal((await post({})).status, 401)
  assert.equal((await post({ Authorization: `Bearer ${token}`, Origin: 'https://evil.invalid' })).status, 403)
  assert.equal((await post({ Authorization: `Bearer ${token}` })).status, 200)
  assert.equal((await post({ Authorization: `Bearer ${token}` })).status, 409)
  const valid = await (await fetch(app.url + '/api/snapshot')).json()
  await writeFile(path.join(root, '.groundwork/plans/members/owner.json'), '{broken')
  const invalid = await (await fetch(app.url + '/api/snapshot')).json()
  assert.match(invalid.error, /owner.json/)
  assert.equal(invalid.plan.revision, valid.plan.revision)
  assert.equal((await fetch(app.url + '/api/asset?path=../README.md')).status, 400)
  assert.equal((await fetch(app.url + '/api/asset?path=assets/secret.svg')).status, 400)
  assert.equal(await new Promise(resolve => { get(app.url + '/api/snapshot', { headers: { Host: 'evil.invalid' } }, response => { response.resume(); resolve(response.statusCode) }) }), 403)
})
test('Word Loop exports with brief criteria, unassessed deltas and screenshots preserved', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-export-')); t.after(() => rm(root, { recursive: true, force: true }))
  const source = path.resolve('content')
  await exportLegacy(source, root, { name: 'Word Loop', assets: path.resolve('public/images'), supplement: path.resolve('docs/wordloop-meeting-recording/portable') })
  const plan = await readPlan(root)
  const feature = plan.snapshot.features.find(f => f.id === 'meeting-recording')!
  assert.ok(feature)
  assert.equal(plan.delivery['meeting-recording'].deliverables.length, 11)
  assert.ok(plan.delivery['meeting-recording'].tasks.length === 28)
  assert.ok(Object.keys(plan.decisions).length > 20)
  assert.equal(feature.spec!.purpose!.success!.length, loadLegacyCriterionCount(await readFile(path.join(source, 'features/meeting-recording/purpose.json'), 'utf8')))
  assert.ok(feature.spec!.api!.contracts.some(c => c.change === 'unspecified'))
  for (const mock of feature.spec!.design!.mockups ?? []) if (mock.ref.startsWith('assets/')) assert.ok((await readFile(path.join(root, '.groundwork/plans', mock.ref))).length)
})
function loadLegacyCriterionCount(raw: string) { return JSON.parse(raw).success.length }

test('live events reconcile external edits, malformed revisions and recovery', { timeout: 15000 }, async t => {
  const root = await fixture(t)
  const app = await serve({ root, port: 0 }); t.after(() => app.close())
  const abort = new AbortController(); t.after(() => abort.abort())
  const stream = await fetch(app.url + '/api/events', { signal: abort.signal })
  const reader = stream.body!.getReader()
  let buffer = ''
  async function nextEvent() {
    for (;;) {
      const boundary = buffer.indexOf('\n\n')
      if (boundary >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
        if (frame.startsWith('data: ')) return JSON.parse(frame.slice(6))
      } else {
        const next = await reader.read()
        if (next.done) throw new Error('Stream ended unexpectedly')
        buffer += new TextDecoder().decode(next.value)
      }
    }
  }
  const initial = await nextEvent()
  assert.equal(initial.error, null)
  const file = path.join(root, '.groundwork/plans/members/owner.json')
  await writeFile(file, '{broken')
  let invalid = await nextEvent()
  while (!invalid.error) invalid = await nextEvent()
  assert.equal(invalid.plan.revision, initial.plan.revision)
  await writeFile(file, JSON.stringify({ id: 'owner', name: 'Edited outside Groundwork' }))
  let restored = await nextEvent()
  while (restored.error) restored = await nextEvent()
  assert.equal(restored.plan.snapshot.members[0].name, 'Edited outside Groundwork')
  abort.abort()
})

test('explicit worktree creation uses the requested branch and start ref without switching the current checkout', async t => {
  const root = await fixture(t, true), plan = await readPlan(root)
  const target = path.join(root, 'new-worktree')
  await operate('create_worktree', { branch: 'codex/new-work', path: target, startRef: 'main', expectedRevision: plan.revision, expectedContext: plan.context.token }, root)
  assert.equal((await context(target)).branch, 'codex/new-work')
  assert.equal((await context(root)).branch, 'main')
  assert.equal((await readPlan(target)).manifest.id, plan.manifest.id)
})

test('portable assets require existing files, update versions when changed, and reject legacy absolute paths', async t => {
  const root = await fixture(t), plan = await feature(root)
  const file = 'features/first/design.json'
  const design = (ref: string) => JSON.stringify({ mockups: [{ id: 'screen', title: 'Screen', kind: 'image', ref }] })
  await assert.rejects(writePlan(root, request(plan, { [file]: design('/images/screen.png') })), /repository-relative/)
  await assert.rejects(writePlan(root, request(plan, { [file]: design('assets/screen.png') })), /Missing raster/)
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path.join(root, '.groundwork/plans/assets'))
  await writeFile(path.join(root, '.groundwork/plans/assets/screen.png'), Buffer.from([137, 80, 78, 71]))
  await writePlan(root, request(plan, { [file]: design('assets/screen.png') }))
  const first = await readPlan(root)
  await writeFile(path.join(root, '.groundwork/plans/assets/screen.png'), Buffer.from([137, 80, 78, 71, 0]))
  assert.notEqual((await readPlan(root)).assets['assets/screen.png'], first.assets['assets/screen.png'])
})
