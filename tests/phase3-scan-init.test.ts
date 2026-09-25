import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { repositoryDiscoverySchema } from '../src/data/scan-schema.ts'
import { initialise } from '../server/setup.ts'
import { prepareRepositoryScan } from '../server/scan-prepare.ts'
import { applyRepositoryScan } from '../server/scan-baseline.ts'
import { git } from '../server/git.ts'
import { readPlan } from '../server/repository.ts'
import { writePlan } from '../server/repository.ts'
import { commitAll, gitInit, guard, tempDir, writeFiles } from './helpers.ts'

test('scan discoveries accept productId with or without an explicit product choice', () => {
  const discovery = { id: 'api', sourcePath: '.', name: 'API', coverage: { api: 'complete' } }
  assert.equal(repositoryDiscoverySchema.parse(discovery).productId, undefined)
  assert.equal(repositoryDiscoverySchema.parse({ ...discovery, productId: 'api' }).productId, 'api')
})

test('init derives one stable product ID and slug from origin across differently named clones', async t => {
  const base = await tempDir(t, 'groundwork-phase3-init-')
  const products: { id: string; slug: string; files: string[] }[] = []
  for (const folder of ['checkout-one', 'another-folder']) {
    const root = await gitInit(path.join(base, folder))
    await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/Price-API.git'])
    await initialise(root, { name: 'Price API' })
    const plan = await readPlan(root)
    products.push({
      id: plan.snapshot.products[0].id,
      slug: plan.snapshot.products[0].slug,
      files: Object.keys(plan.files).filter(file => file.startsWith('products/')),
    })
  }
  assert.deepEqual(products, [
    { id: 'price-api', slug: 'price-api', files: ['products/price-api.json'] },
    { id: 'price-api', slug: 'price-api', files: ['products/price-api.json'] },
  ])
})

test('an omitted scan productId resolves to the sole owner and still writes the legacy component form', async t => {
  const root = await gitInit(await tempDir(t, 'groundwork-phase3-scan-'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/api.git'])
  await writeFiles(root, { 'package.json': '{"name":"api"}\n' })
  await commitAll(root)
  await initialise(root, { name: 'API' })
  const prepared = await prepareRepositoryScan(root, { repository: root })
  const before = await readPlan(root)
  await applyRepositoryScan(root, {
    scanId: prepared.scanId, expectedRevision: before.revision, expectedContext: before.context.token,
    discoveries: [{ id: 'api', sourcePath: '.', name: 'API',
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' } }],
  })
  const after = await readPlan(root)
  assert.equal(after.snapshot.components[0].productId, 'api')
  const component = JSON.parse(await readFile(path.join(root, '.groundwork/plans/components/api.json'), 'utf8'))
  assert.equal(component.productId, 'api', 'unmigrated homes persist the legacy component form')
  assert.equal('schemaVersion' in component, false)
})

test('an omitted productId cannot choose between legacy products', async t => {
  const root = await gitInit(await tempDir(t, 'groundwork-phase3-ambiguous-'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/api.git'])
  await writeFiles(root, { 'package.json': '{"name":"api"}\n' })
  await commitAll(root)
  await initialise(root, { name: 'API' })
  const initial = await readPlan(root)
  await writePlan(root, { ...guard(initial), changes: {
    'products/other.json': JSON.stringify({ id: 'other', slug: 'other', name: 'Other', kind: 'service-system' }),
  } })
  const prepared = await prepareRepositoryScan(root, { repository: root })
  const before = await readPlan(root)
  const input = {
    scanId: prepared.scanId, expectedRevision: before.revision, expectedContext: before.context.token,
    discoveries: [{ id: 'api', sourcePath: '.', name: 'API',
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' } }],
  }
  await assert.rejects(applyRepositoryScan(root, input), /productId is required because no unique product owns/)
  assert.equal((await readPlan(root)).snapshot.components.length, 0)
  await applyRepositoryScan(root, { ...input, discoveries: [{ ...input.discoveries[0], productId: 'api' }] })
  assert.equal((await readPlan(root)).snapshot.components[0].productId, 'api')
})
