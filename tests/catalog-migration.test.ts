import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import type { TestContext } from 'node:test'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { readPlan, writePlan, readStorageFiles, atomicFile, recover } from '../server/repository.ts'
import { migrateCatalog } from '../server/catalog-migration.ts'
import { encodeStorage } from '../server/catalog-storage.ts'
import { queryCatalog } from '../server/catalog.ts'
import { git } from '../server/git.ts'
import { Conflict } from '../server/errors.ts'
import { gitInit, guard, tempDir } from './helpers.ts'
async function fixture(t: TestContext) {
  const root = await tempDir(t, 'groundwork-migrate-')
  await initialise(root, { name: 'Migration' })
  const plan = await readPlan(root)
  await writePlan(root, { ...guard(plan), changes: {
    'components/service.json': JSON.stringify({ id: 'service', productId: 'app', name: 'Service', api: { name: 'API', endpoints: [{ id: 'read', name: 'Read', method: 'GET', path: '/read' }] }, executionFlows: [], findings: [] })
  } })
  return root
}
test('catalog migration preserves query facts, split writes, historical refs and idempotency', async t => {
  const root = await fixture(t)
  await gitInit(root); await git(root, ['add', '.groundwork/plans'])
  await git(root, ['commit', '-q', '-m', 'Legacy catalog'])
  const old = await readPlan(root)
  const dry = await migrateCatalog(root, {})
  assert.equal(dry.status, 'dry-run')
  assert.equal((await readPlan(root)).layout, 'legacy')
  await assert.rejects(migrateCatalog(root, { dryRun: false }), error => error instanceof Conflict && /revision and context/.test(error.message))
  const applied = await migrateCatalog(root, { dryRun: false, expectedRevision: dry.expectedRevision, expectedContext: dry.expectedContext })
  assert.equal(applied.status, 'migrated')
  const migrated = await readPlan(root)
  assert.deepEqual(migrated.snapshot, old.snapshot)
  assert.equal(migrated.layout, 'catalog-v1')
  assert.ok(await readFile(path.join(root, '.groundwork/catalog/components/service/api.json'), 'utf8'))
  await assert.rejects(readFile(path.join(root, '.groundwork/plans/components/service.json')))
  assert.equal((await migrateCatalog(root, { dryRun: false })).status, 'already-migrated')
  assert.equal((await readPlan(root, 'HEAD')).layout, 'legacy')
  const a: any = queryCatalog(old, 'search_catalog', { query: 'Read' }), b: any = queryCatalog(migrated, 'search_catalog', { query: 'Read' })
  assert.deepEqual(a.items, b.items)
  const component = JSON.parse(migrated.files['components/service.json']); component.name = 'Renamed service'
  await writePlan(root, { ...guard(migrated), changes: { 'components/service.json': JSON.stringify(component) } })
  assert.equal((await readPlan(root)).snapshot.components[0].name, 'Renamed service')
  await assert.rejects(initialise(root), /already exists/)
})
test('migration recovery restores interrupted physical writes and mixed authority is rejected', async t => {
  const root = await fixture(t), plan = await readPlan(root), before = await readStorageFiles(root), after = encodeStorage(plan.files, 'catalog-v1')
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name])
  await atomicFile(root, '.groundwork/transaction.json', JSON.stringify({ version: 2, before, after, paths }))
  for (const name of paths.slice(0, 3)) await atomicFile(root, name, after[name] ?? null)
  await assert.rejects(readPlan(root), /pending/)
  await recover(root)
  assert.deepEqual(await readStorageFiles(root), before)
  const dry = await migrateCatalog(root, {})
  await migrateCatalog(root, { dryRun: false, expectedRevision: dry.expectedRevision, expectedContext: dry.expectedContext })
  await mkdir(path.join(root, '.groundwork/plans/components'), { recursive: true })
  await writeFile(path.join(root, '.groundwork/plans/components/service.json'), plan.files['components/service.json'])
  await assert.rejects(readPlan(root), /Mixed catalog authority/)
})
