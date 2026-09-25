import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, lstat, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { refreshCatalogCache } from '../server/catalog-cache.ts'
import { git } from '../server/git.ts'
import { resolveProductCatalog } from '../server/product-catalog.ts'
import { commitAll, gitInit, homeFixture, writeFiles } from './helpers.ts'

test('a product resolves only its own local catalog and retains unregistered source repositories', async t => {
  const home = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const result = await resolveProductCatalog(home, 'price-engine', {}, home, { useCache: false })
  assert.equal(result.homeRepository, 'volvo-cars/price-engine')
  assert.deepEqual(result.repositories.map(item => item.repository),
    ['volvo-cars/gpe-pretax', 'volvo-cars/price-engine', 'volvo-cars/utils'])
  const pretax = result.repositories.find(item => item.repository === 'volvo-cars/gpe-pretax')!
  assert.equal(pretax.source, null, 'no clone was supplied')
  assert.equal(pretax.components[0].id, 'pretax-api--src-api')
  assert.equal(pretax.components[0].api?.endpoints[0].id, 'prices')
  assert.equal(pretax.resolution.areas.find(item => item.unit.area === 'api')?.provenance.catalog, 'local')
  assert.match(pretax.local.label, /volvo-cars\/price-engine@/)
  const own = result.repositories.find(item => item.repository === 'volvo-cars/price-engine')!
  assert.equal(own.components.length, 2)
  assert.ok(own.resolution.areas.every(item => item.provenance.catalog === 'source'))
  assert.deepEqual(result.repositories.find(item => item.repository === 'volvo-cars/utils')?.components, [])
  const otherProduct = await resolveProductCatalog(home, 'product-configuration-facade', {}, home, { useCache: false })
  assert.deepEqual(otherProduct.repositories.map(item => item.repository), ['volvo-cars/product-configuration-facade'])
  assert.deepEqual(otherProduct.repositories[0].components, [], 'another product cannot inherit price-engine local knowledge')
})

test('historical product view reads both home and local catalog from the same committed ref', async t => {
  const home = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const ref = await commitAll(home, 'Home and local catalog')
  const api = path.join(home, '.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/components/pretax-api--src-api/api.json')
  const changed = JSON.parse(await readFile(api, 'utf8')) as { endpoints: { id: string }[] }
  changed.endpoints[0].id = 'later-working-tree'
  await writeFile(api, JSON.stringify(changed))
  const historical = await resolveProductCatalog(home, 'price-engine', {}, home, { homeRef: ref, useCache: false })
  const pretax = historical.repositories.find(item => item.repository === 'volvo-cars/gpe-pretax')!
  assert.equal(pretax.components[0].api?.endpoints[0].id, 'prices')
  assert.equal(pretax.local.commit, ref)
  assert.equal(pretax.local.workingTree, false)
  assert.match(pretax.local.label, /committed ref/)
  const current = await resolveProductCatalog(home, 'price-engine', {}, home, { useCache: false })
  assert.equal(current.repositories.find(item => item.repository === 'volvo-cars/gpe-pretax')?.components[0].api?.endpoints[0].id,
    'later-working-tree')
})

test('an unmigrated home does not compare its own source catalog against the same legacy documents', async t => {
  const home = await homeFixture(t, 'legacy', 'git@github.com:volvo-cars/legacy-home.git')
  const result = await resolveProductCatalog(home, 'app', {}, home, { useCache: false })
  const own = result.repositories.find(item => item.repository === result.homeRepository)!
  assert.equal(own.components.length, 1)
  assert.deepEqual(own.resolution.warnings, [])
  assert.ok(own.resolution.areas.every(item => item.provenance.reason === 'source-only'))
})

test('a ready Hub cache supplies a pinned missing source catalog without refreshing it', async t => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'groundwork-product-cache-')))
  const makeWritable = async (target: string): Promise<void> => {
    const info = await lstat(target).catch(() => null)
    if (!info) return
    if (info.isDirectory()) {
      await chmod(target, 0o700)
      for (const name of await readdir(target)) await makeWritable(path.join(target, name))
    } else if (info.isFile()) await chmod(target, 0o600)
  }
  t.after(async () => { await makeWritable(base); await rm(base, { recursive: true, force: true }) })
  const source = await gitInit(path.join(base, 'source'))
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await writeFiles(source, { '.groundwork/catalog/components/api/component.json': JSON.stringify({
    schemaVersion: 3, id: 'api', name: 'Cached API', repo: 'acme/source', sourcePath: '.',
  }) })
  const revision = await commitAll(source, 'Shared source catalog')
  const remote = path.join(base, 'remote.git')
  await git(base, ['clone', '--bare', '--quiet', source, remote])
  await git(remote, ['config', 'uploadpack.allowFilter', 'true'])
  const cacheRoot = path.join(base, 'cache')
  await refreshCatalogCache({ repository: 'acme/source', remote }, { cacheRoot, allowUnverifiedLocalRemote: true })
  const home = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const productPath = path.join(home, '.groundwork/products/price-engine.json')
  const product = JSON.parse(await readFile(productPath, 'utf8')) as { repositories: unknown[] }
  product.repositories = [{ repository: 'acme/source', role: 'owned' }]
  await writeFile(productPath, JSON.stringify(product))
  await rename(remote, `${remote}.offline`)
  const result = await resolveProductCatalog(home, 'price-engine', {}, home, { cacheRoot })
  assert.equal(result.repositories[0].source?.commit, revision)
  assert.match(result.repositories[0].source?.label ?? '', /Hub cache/)
  assert.equal(result.repositories[0].components[0].name, 'Cached API')
})
