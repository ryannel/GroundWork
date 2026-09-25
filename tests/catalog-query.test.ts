import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { queryCatalog, detailParts, normaliseTerm, searchWords } from '../server/catalog.ts'
import { catalogId, parseCatalogId } from '../src/data/catalog-identity.ts'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { operate } from '../server/operations.ts'
import { catalogFiles, msrpEndpoint } from './fixtures/catalog.ts'
import { tempDir } from './helpers.ts'
import type { Relation } from '../src/data/catalog-index.ts'
import { productRoute } from '../src/data/view-models.ts'

/** The fields of a catalog search summary these tests read. */
type Summary = {
  id: string; componentId: string; investigation: string; matchReasons: string[]
  freshness: { status: string }; pointers: { path: string }[]; relations: Relation[]
}
const summaries = (response: { items: unknown[] }) => response.items as Summary[]

const msrp = catalogId('catalog', 'price-service', 'endpoint', msrpEndpoint)
async function fixture(t: TestContext) {
  const root = await tempDir(t, 'groundwork-query-')
  await initialise(root, { files: catalogFiles })
  return { root, plan: await readPlan(root) }
}
test('evaluation: exact, paraphrase, traced path, consumer, ambiguity and missing knowledge', async t => {
  const { plan } = await fixture(t)
  const cases = [
    { question: 'MSRP', expected: msrp },
    { question: 'manufacturer suggested retail price of a bicycle', expected: msrp },
    { question: 'upload full catalogue', expected: catalogId('catalog', 'catalogue-gateway', 'endpoint', 'http-full-catalogue-upload') },
    { question: 'consume price event', expected: catalogId('catalog', 'price-event-relay', 'component', 'price-event-relay') },
  ]
  for (const scenario of cases) {
    const response = queryCatalog(plan, 'get_discovery_context', { question: scenario.question, limit: 5 })
    const items = summaries(response)
    assert.ok(items.some(item => item.id === scenario.expected), scenario.question)
    assert.ok(items.every(item => item.freshness.status === 'unchecked'))
    assert.ok(Buffer.byteLength(JSON.stringify(response)) <= response.limits.maxBytes)
  }
  const untraced = summaries(queryCatalog(plan, 'search_catalog', { query: 'MSRP', kinds: ['endpoint'] }))
  assert.equal(untraced[0].investigation, 'Not investigated')
  assert.ok(untraced[0].pointers.some(p => p.path.endsWith('PricesController.cs')))
  assert.ok(untraced[0].relations.some(r => r.reason === 'request contract' && r.kind === 'contract' && !r.reverse))
  assert.ok(!untraced[0].relations.some(r => r.reason.startsWith('Referenced by schema')), 'a reverse link is never reversed again')
  const unknown = queryCatalog(plan, 'search_catalog', { query: 'quantum payroll' })
  assert.equal(unknown.total, 0)
  assert.match(unknown.uncertainty, /do not prove absence/)
  const ambiguous = summaries(queryCatalog(plan, 'search_catalog', { query: 'price', kinds: ['endpoint'], limit: 50 }))
  assert.ok(new Set(ambiguous.map(item => item.componentId)).size > 1)
})
test('a shared used catalog links to the product selected by the caller', async t => {
  const { plan } = await fixture(t)
  const owner = { ...plan.snapshot.products[0], repositories: [{ repository: 'acme/shared', role: 'owned' as const }] }
  const user = { ...owner, id: 'consumer', slug: 'consumer', name: 'Consumer',
    repositories: [{ repository: 'acme/shared', role: 'used' as const }] }
  const shared = { ...plan.snapshot.components[0], repo: 'acme/shared', sourcePath: '.', productId: undefined }
  const scoped = { ...plan, snapshot: { ...plan.snapshot, products: [owner, user], components: [shared] } }
  for (const [operation, args] of [
    ['search_catalog', { query: '', componentId: shared.id, productId: user.id }],
    ['get_discovery_context', { question: shared.name, componentId: shared.id, productId: user.id }],
  ] as const) {
    const [item] = queryCatalog(scoped, operation, args).items as
      { productId: string; productIds: string[]; location: string }[]
    assert.equal(item.productId, user.id)
    assert.deepEqual(item.productIds, [owner.id, user.id])
    assert.ok(item.location.includes(`${productRoute(plan.repository.id, 'consumer')}?`))
  }
})
test('pagination is bounded, complete, deterministic, and rejects changed query/snapshot/checkout', async t => {
  const { root, plan } = await fixture(t)
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = queryCatalog(plan, 'search_catalog', { query: '', limit: 3, maxBytes: 12000, cursor })
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 12000)
    ids.push(...summaries(page).map(item => item.id))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length > 50)
  const first = queryCatalog(plan, 'search_catalog', { query: '', limit: 3 })
  assert.deepEqual(first, queryCatalog(plan, 'search_catalog', { query: '', limit: 3 }))
  const next = { query: '', limit: 3, cursor: first.nextCursor }
  assert.throws(() => queryCatalog({ ...plan, revision: 'changed' }, 'search_catalog', next), /snapshot or query changed/)
  assert.throws(() => queryCatalog({ ...plan, context: { ...plan.context, token: 'other-checkout' } }, 'search_catalog', next), /snapshot or query changed/)
  assert.throws(() => queryCatalog(plan, 'search_catalog', { query: 'price', limit: 3, cursor: first.nextCursor }), /snapshot or query changed/)
  for (const malformed of ['bnVsbA', 'e30', Buffer.from(JSON.stringify({ snapshot: 'x', query: 'y', offset: -1 })).toString('base64url')]) {
    assert.throws(() => queryCatalog(plan, 'search_catalog', { query: '', cursor: malformed }), /Invalid catalog cursor/)
  }
  assert.throws(() => queryCatalog(plan, 'search_catalog', { limit: 500 }), /50/)
  assert.deepEqual(await operate('search_catalog', { query: 'MSRP' }, root), queryCatalog(plan, 'search_catalog', { query: 'MSRP' }))
})
test('exact details can be recovered without returning the component schema inventory', async t => {
  const { plan } = await fixture(t)
  const parts: unknown[] = []
  let cursor: string | undefined
  do { const page = queryCatalog(plan, 'get_catalog_entity', { id: msrp, limit: 2, cursor }); parts.push(...page.items); cursor = page.nextCursor ?? undefined } while (cursor)
  const serialized = JSON.stringify(parts)
  assert.match(serialized, /MsrpPriceRequest/)
  assert.doesNotMatch(serialized, /PriceListRequest/, 'schemas the endpoint does not reference stay out of its detail')
  assert.throws(() => queryCatalog(plan, 'get_catalog_entity', { id: msrp.replace('catalog/', 'other/') }), /not found/)
  const large = detailParts({ example: '🐈'.repeat(20000) })
  assert.equal(large.map(part => part.value).join(''), '🐈'.repeat(20000))
  assert.deepEqual(parseCatalogId(catalogId('p', 'c', 'schema', 'A/B')), { scope: 'p', component: 'c', kind: 'schema', entity: 'A/B' })
})
test('search normaliser splits identifiers and meets singular and plural forms', () => {
  const cases: [string, string][] = [
    ['apis', 'api'], ['jobs', 'job'], ['ids', 'id'], ['statuses', 'status'], ['status', 'status'], ['queries', 'query'],
    ['addresses', 'address'], ['address', 'address'], ['boxes', 'box'], ['buses', 'bus'], ['responses', 'response'],
    ['causes', 'cause'], ['analysis', 'analysis'], ['consumers', 'consume'], ['publishing', 'publish'],
  ]
  for (const [word, expected] of cases) assert.equal(normaliseTerm(word), expected, word)
  assert.deepEqual(searchWords('HTTPServer getHTTPResponse v5Prices'), ['http', 'server', 'get', 'http', 'response', 'v5', 'prices'])
})

test('plural queries match singular catalog text and reasons quote the query word', async t => {
  const { plan } = await fixture(t)
  const singular = queryCatalog(plan, 'search_catalog', { query: 'price', limit: 50 })
  const plural = queryCatalog(plan, 'search_catalog', { query: 'prices', limit: 50 })
  assert.equal(plural.total, singular.total)
  assert.ok(summaries(plural).every(item => item.matchReasons.includes('Text match: prices')))
})

test('a cursor survives a larger byte or item limit', async t => {
  const { plan } = await fixture(t)
  const first = queryCatalog(plan, 'search_catalog', { query: '', limit: 2 })
  const next = queryCatalog(plan, 'search_catalog', { query: '', limit: 5, maxBytes: 65536, cursor: first.nextCursor! })
  assert.equal(next.offset, 2)
  assert.equal(next.items.length, 5)
})
