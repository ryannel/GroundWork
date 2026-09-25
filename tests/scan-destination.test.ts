import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { git } from '../server/git.ts'
import { initialise } from '../server/setup.ts'
import { applyRepositoryScan } from '../server/scan-baseline.ts'
import { chooseScanDestination } from '../server/scan-destination.ts'
import { prepareRepositoryScan } from '../server/scan-prepare.ts'
import { readCatalogTarget, readPlan, writeCatalogTarget } from '../server/repository.ts'
import { gitInit, tempDir } from './helpers.ts'

test('a scan defaults to the writable source catalog and warns about working tree changes', async t => {
  const home = await tempDir(t, 'groundwork-scan-home-')
  await initialise(home, { name: 'Home' })
  const source = await gitInit(await tempDir(t, 'groundwork-scan-source-'))
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/api.git'])
  await writeFile(path.join(source, 'package.json'), '{"name":"api"}\n')
  await git(source, ['add', '.'])
  await git(source, ['commit', '-m', 'Initial source'])
  await writeFile(path.join(source, 'uncommitted.txt'), 'excluded from the pinned scan\n')
  const prepared = await prepareRepositoryScan(home, { repository: source })
  assert.equal(prepared.destination.kind, 'source')
  assert.equal(prepared.destination.root, source)
  assert.match(prepared.warnings.join(' '), /uncommitted change/)
  const target = await readCatalogTarget(source, prepared.repository, 'source')
  const productId = (await readPlan(home)).snapshot.products[0].id
  await applyRepositoryScan(home, {
    scanId: prepared.scanId, expectedRevision: target.revision, expectedContext: target.context.token,
    discoveries: [{ id: 'api', productId, sourcePath: '.', name: 'API',
      coverage: { dependencies: 'partial', api: 'partial', data: 'partial', messaging: 'partial' } }],
  })
  const sourceComponent = (await readCatalogTarget(source, prepared.repository, 'source')).plan.snapshot.components[0]
  assert.equal(sourceComponent.id, 'api')
  assert.equal(sourceComponent.productId, undefined)
  assert.deepEqual((await readPlan(home)).snapshot.components, [])
  const physical = JSON.parse(await readFile(path.join(source, '.groundwork/catalog/components/api/component.json'), 'utf8'))
  assert.equal(physical.schemaVersion, 3)
  assert.equal(physical.scan.areaRevisions.api.revision, prepared.revision)
})

test('an uninitialised source checkout accepts a guarded source catalog without creating a product', async t => {
  const root = await tempDir(t, 'groundwork-source-catalog-')
  await gitInit(root)
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  const before = await readCatalogTarget(root, 'acme/source', 'source')
  assert.deepEqual(before.plan.snapshot.products, [])
  const component = JSON.stringify({ schemaVersion: 3, id: 'api', name: 'API', repo: 'acme/source', sourcePath: '.' })
  await writeCatalogTarget(root, 'acme/source', 'source', {
    expectedRevision: before.revision, expectedContext: before.context.token,
    changes: { 'components/api.json': component },
  })
  assert.equal(JSON.parse(await readFile(path.join(root, '.groundwork/catalog/components/api/component.json'), 'utf8')).id, 'api')
  assert.deepEqual((await readPlan(root)).snapshot.products, [])
  assert.deepEqual((await readCatalogTarget(root, 'acme/source', 'source')).plan.snapshot.components.map(item => item.id), ['api'])
})

test('a migrated home writes a local catalog under the source repository identity', async t => {
  const root = await tempDir(t, 'groundwork-local-catalog-')
  await gitInit(root)
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/home.git'])
  await mkdir(path.join(root, '.groundwork/products'), { recursive: true })
  await writeFile(path.join(root, '.groundwork/legacy-ids.json'), '{"version":1,"ids":{}}\n')
  await writeFile(path.join(root, '.groundwork/products/app.json'), JSON.stringify({
    schemaVersion: 3, id: 'app', slug: 'app', name: 'App', kind: 'service-system',
    repositories: [{ repository: 'acme/source', role: 'owned' }],
  }))
  const before = await readCatalogTarget(root, 'acme/source', 'local')
  assert.deepEqual(before.files, {})
  await writeCatalogTarget(root, 'acme/source', 'local', {
    expectedRevision: before.revision, expectedContext: before.context.token,
    changes: { 'components/api.json': JSON.stringify({ schemaVersion: 3, id: 'api', name: 'API', repo: 'acme/source', sourcePath: '.' }) },
  })
  assert.equal(JSON.parse(await readFile(path.join(root,
    '.groundwork/local-catalogs/github.com/acme/source/components/api/component.json'), 'utf8')).id, 'api')
  assert.deepEqual((await readCatalogTarget(root, 'acme/source', 'local')).plan.snapshot.components.map(item => item.id), ['api'])
  assert.deepEqual((await readPlan(root)).snapshot.components, [], 'the local catalog does not become the home source catalog')
})

test('an explicitly local scan applies to a migrated home local catalog', async t => {
  const home = await gitInit(await tempDir(t, 'groundwork-local-scan-home-'))
  await git(home, ['remote', 'add', 'origin', 'git@github.com:acme/home.git'])
  await mkdir(path.join(home, '.groundwork/products'), { recursive: true })
  await writeFile(path.join(home, '.groundwork/legacy-ids.json'), '{"version":1,"ids":{}}\n')
  await writeFile(path.join(home, '.groundwork/products/app.json'), JSON.stringify({
    schemaVersion: 3, id: 'app', slug: 'app', name: 'App', kind: 'service-system',
    repositories: [{ repository: 'acme/source', role: 'owned' }],
  }))
  const source = await gitInit(await tempDir(t, 'groundwork-local-scan-source-'))
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await writeFile(path.join(source, 'package.json'), '{"name":"api"}\n')
  await git(source, ['add', '.'])
  await git(source, ['commit', '-m', 'Initial source'])
  const prepared = await prepareRepositoryScan(home, { repository: source, destination: 'local' })
  assert.equal(prepared.destination.kind, 'local')
  const target = await readCatalogTarget(home, prepared.repository, 'local')
  await applyRepositoryScan(home, {
    scanId: prepared.scanId, expectedRevision: target.revision, expectedContext: target.context.token,
    discoveries: [{ id: 'api', sourcePath: '.', name: 'API',
      coverage: { dependencies: 'partial', api: 'partial', data: 'partial', messaging: 'partial' } }],
  })
  const local = (await readCatalogTarget(home, 'acme/source', 'local')).plan.snapshot.components[0]
  assert.equal(local.id, 'api')
  assert.equal(local.productId, undefined)
  assert.deepEqual((await readPlan(home)).snapshot.components, [])
  assert.equal(JSON.parse(await readFile(path.join(home,
    '.groundwork/local-catalogs/github.com/acme/source/components/api/component.json'), 'utf8')).repo, 'acme/source')
})

test('an external legacy source home remains local until its catalog is migrated', async t => {
  const home = await gitInit(await tempDir(t, 'groundwork-legacy-caller-'))
  const source = await gitInit(await tempDir(t, 'groundwork-legacy-target-'))
  await git(home, ['remote', 'add', 'origin', 'git@github.com:acme/home.git'])
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await initialise(home, { name: 'Home' })
  await initialise(source, { name: 'Source' })
  const chosen = await chooseScanDestination(home, source, 'acme/source')
  assert.equal(chosen.destination.kind, 'local')
  assert.match(chosen.warnings.join(' '), /legacy product-scoped catalog/)
  await assert.rejects(chooseScanDestination(home, source, 'acme/source', 'source'), /Migrate the source home/)
})
