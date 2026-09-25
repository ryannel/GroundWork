import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { queryCatalog, detailParts, normaliseTerm, searchWords } from '../server/catalog.ts'
import { catalogId } from '../shared/catalog-identity.ts'
import { git } from '../server/git.ts'
import { gitInit, tempDir } from './helpers.ts'

async function fixture(t: Parameters<typeof tempDir>[0]) {
  const root = await gitInit(await tempDir(t, 'groundwork-query-'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/catalog.git'])
  const revision = 'a'.repeat(40)
  const evidence = [{ path: 'src/pricing.ts', lines: '1-3', claim: 'Calculates the price', revision }]
  await initialise(root, { files: {
    'products/pricing.json': JSON.stringify({ id: 'pricing', slug: 'pricing', name: 'Pricing', kind: 'service-system',
      repositories: [{ repository: 'acme/catalog', role: 'owned' }] }),
    'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
    'components/price-service.json': JSON.stringify({ id: 'price-service', name: 'Price Service', repo: 'acme/catalog',
      sourcePath: 'src', sourceRevision: revision, evidence,
      api: { name: 'Pricing API', endpoints: [
        { id: 'msrp', name: 'Calculate MSRP', method: 'POST', path: '/prices/msrp', summary: 'Manufacturer suggested retail price', evidence },
        { id: 'discount', name: 'Apply discount', method: 'POST', path: '/prices/discount', summary: 'Apply a discount', evidence },
      ] },
      areaGaps: { dependencies: [], api: [], data: [], messaging: [], jobs: [], flows: [] },
    }),
  } })
  return readPlan(root)
}

test('search_catalog finds cited entities by exact and paraphrased terms', async t => {
  const plan = await fixture(t)
  const id = catalogId('acme/catalog', 'price-service', 'endpoint', 'msrp')
  const exact = queryCatalog(plan, 'search_catalog', { query: 'MSRP' })
  const paraphrase = queryCatalog(plan, 'search_catalog', { query: 'manufacturer suggested retail price' })
  assert.ok(exact.items.some((item: any) => item.id === id))
  assert.ok(paraphrase.items.some((item: any) => item.id === id))
})

test('catalog search pages are stable and reject a changed query', async t => {
  const plan = await fixture(t)
  const first = queryCatalog(plan, 'search_catalog', { query: 'price', limit: 1 })
  assert.equal(first.items.length, 1)
  assert.ok(first.nextCursor)
  const second = queryCatalog(plan, 'search_catalog', { query: 'price', limit: 1, cursor: first.nextCursor! })
  assert.equal(second.items.length, 1)
  assert.notEqual((first.items[0] as any).id, (second.items[0] as any).id)
  assert.throws(() => queryCatalog(plan, 'search_catalog', { query: 'discount', cursor: first.nextCursor! }), /changed/)
})

test('get_catalog_entity returns lossless detail and source citations', async t => {
  const plan = await fixture(t)
  const id = catalogId('acme/catalog', 'price-service', 'endpoint', 'msrp')
  const detail = queryCatalog(plan, 'get_catalog_entity', { id })
  assert.equal(detail.totalCandidates, 1)
  assert.ok(detail.items.length)
  assert.ok(JSON.stringify(detail.items).includes('src/pricing.ts'))
  assert.throws(() => queryCatalog(plan, 'get_catalog_entity', { id: 'invalid' }), /catalog ID/)
})

test('search normaliser splits identifiers and meets singular and plural forms', () => {
  assert.deepEqual(searchWords('HTTPServerStatus'), ['HTTP', 'Server', 'Status'].map(value => value.toLowerCase()))
  assert.equal(normaliseTerm('prices'), 'price')
  assert.ok(detailParts({ long: 'x'.repeat(4000) }).length > 1)
})
