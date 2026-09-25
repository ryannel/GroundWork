import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveProductCatalog } from '../server/product-catalog.ts'
import { commitAll, homeFixture } from './helpers.ts'

async function selectLocalPretax(home: string) {
  const file = path.join(home, '.groundwork/products/price-engine.json')
  const product = JSON.parse(await readFile(file, 'utf8'))
  const entry = product.repositories.find((item: { repository: string }) => item.repository === 'volvo-cars/gpe-pretax')
  entry.catalog = 'local'
  await writeFile(file, JSON.stringify(product, null, 2) + '\n')
}

test('a product uses its explicit local catalog and defaults other repositories to source', async t => {
  const home = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  await selectLocalPretax(home)
  const result = await resolveProductCatalog(home, 'price-engine', {}, home)
  assert.equal(result.homeRepository, 'volvo-cars/price-engine')
  assert.deepEqual(result.repositories.map(item => item.repository),
    ['volvo-cars/gpe-pretax', 'volvo-cars/price-engine', 'volvo-cars/utils'])
  const pretax = result.repositories[0]
  assert.equal(pretax.selected, 'local')
  assert.equal(pretax.source, null)
  assert.equal(pretax.components[0].id, 'pretax-api--src-api')
  assert.equal(pretax.components[0].api?.endpoints[0].id, 'prices')
  const own = result.repositories[1]
  assert.equal(own.selected, 'source')
  assert.equal(own.components.length, 2)
  assert.deepEqual(result.repositories[2].components, [], 'a missing local clone does not trigger a fetch')
  const other = await resolveProductCatalog(home, 'product-configuration-facade', {}, home)
  assert.deepEqual(other.repositories.map(item => item.repository), ['volvo-cars/product-configuration-facade'])
  assert.deepEqual(other.repositories[0].components, [])
})

test('a committed product view reads its selected local catalog at that commit', async t => {
  const home = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  await selectLocalPretax(home)
  const ref = await commitAll(home, 'Selected local catalog')
  const api = path.join(home, '.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/components/pretax-api--src-api.json')
  const changed = JSON.parse(await readFile(api, 'utf8')) as { api: { endpoints: { id: string }[] } }
  changed.api.endpoints[0].id = 'later-working-tree'
  await writeFile(api, JSON.stringify(changed))
  const historical = await resolveProductCatalog(home, 'price-engine', {}, home, { homeRef: ref })
  const pretax = historical.repositories[0]
  assert.equal(pretax.components[0].api?.endpoints[0].id, 'prices')
  assert.equal(pretax.local?.commit, ref)
  assert.equal(pretax.local?.workingTree, false)
  const current = await resolveProductCatalog(home, 'price-engine', {}, home)
  assert.equal(current.repositories[0].components[0].api?.endpoints[0].id, 'later-working-tree')
})

test('a repository without a local choice never borrows a home catalog or cache', async t => {
  const home = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const result = await resolveProductCatalog(home, 'price-engine', {}, home)
  assert.equal(result.repositories[0].selected, 'source')
  assert.equal(result.repositories[0].source, null)
  assert.deepEqual(result.repositories[0].components, [])
})
