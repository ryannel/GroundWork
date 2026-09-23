import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { queryCatalog, detailParts } from '../server/catalog.ts'
import { catalogId, parseCatalogId } from '../src/data/catalog-identity.ts'
import { initialise } from '../server/setup.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { operate } from '../server/operations.ts'
import { retainDiscoveryBaseline, getDiscoveryBaseline } from '../server/knowledge.ts'

const components = JSON.parse(await readFile(new URL('./fixtures/catalog/components.json', import.meta.url), 'utf8'))
const products = JSON.parse(await readFile(new URL('./fixtures/catalog/products.json', import.meta.url), 'utf8'))
const msrp = catalogId('catalog', 'gpe-price', 'endpoint', 'post-api-v5-prices-calculate-msrp')
async function fixture(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-query-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const files = {
    'project.json': JSON.stringify({ schemaVersion: 2, id: 'catalog', name: 'Catalog evaluation' }),
    'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
    ...Object.fromEntries(products.map((p: any) => [`products/${p.id}.json`, JSON.stringify(p)])),
    ...Object.fromEntries(components.map((c: any) => [`components/${c.id}.json`, JSON.stringify(c)])),
  }
  await initialise(root, { files })
  return { root, plan: await readPlan(root) }
}
test('evaluation: exact, paraphrase, traced path, consumer, ambiguity and missing knowledge', async t => {
  const { plan } = await fixture(t)
  const cases = [
    { question: 'MSRP', expected: msrp },
    { question: 'manufacturer suggested retail price of a vehicle', expected: msrp },
    { question: 'upload full features', expected: catalogId('catalog', 'product-configuration-facade', 'endpoint', 'http-full-features-upload') },
    { question: 'consume price event', expected: catalogId('catalog', 'price-event-dispatcher', 'component', 'price-event-dispatcher') },
  ]
  for (const scenario of cases) {
    const response = queryCatalog(plan, 'get_discovery_context', { question: scenario.question, limit: 5 })
    const items = response.items as any[]
    assert.ok(items.some(item => item.id === scenario.expected), scenario.question)
    assert.ok(items.every(item => item.freshness.status === 'unchecked'))
    assert.ok(Buffer.byteLength(JSON.stringify(response)) <= response.limits.maxBytes)
  }
  const untraced = queryCatalog(plan, 'search_catalog', { query: 'MSRP', kinds: ['endpoint'] }).items as any[]
  assert.equal(untraced[0].investigation, 'Not investigated')
  assert.ok(untraced[0].pointers.some((p: any) => p.path.endsWith('PricesController.cs')))
  assert.ok(untraced[0].relations.some((r: any) => r.reason === 'request contract'))
  const unknown = queryCatalog(plan, 'search_catalog', { query: 'quantum payroll' })
  assert.equal(unknown.total, 0)
  assert.match(unknown.uncertainty, /do not prove absence/)
  const ambiguous = queryCatalog(plan, 'search_catalog', { query: 'price', kinds: ['endpoint'], limit: 50 }).items as any[]
  assert.ok(new Set(ambiguous.map(item => item.componentId)).size > 1)
})
test('pagination is bounded, complete, deterministic, and rejects changed query/snapshot/checkout', async t => {
  const { root, plan } = await fixture(t)
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = queryCatalog(plan, 'search_catalog', { query: '', limit: 3, maxBytes: 12000, cursor })
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 12000)
    ids.push(...(page.items as any[]).map(item => item.id))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length > 50)
  const first = queryCatalog(plan, 'search_catalog', { query: '', limit: 3 })
  assert.deepEqual(first, queryCatalog(plan, 'search_catalog', { query: '', limit: 3 }))
  assert.throws(() => queryCatalog({ ...plan, revision: 'changed' }, 'search_catalog', { query: '', limit: 3, cursor: first.nextCursor }), /snapshot or query changed/)
  assert.throws(() => queryCatalog({ ...plan, context: { ...plan.context, token: 'other-checkout' } }, 'search_catalog', { query: '', limit: 3, cursor: first.nextCursor }), /snapshot or query changed/)
  assert.throws(() => queryCatalog(plan, 'search_catalog', { query: 'price', limit: 3, cursor: first.nextCursor }), /snapshot or query changed/)
  for (const malformed of ['bnVsbA', 'e30', Buffer.from(JSON.stringify({ snapshot: 'x', query: 'y', offset: -1 })).toString('base64url')]) {
    assert.throws(() => queryCatalog(plan, 'search_catalog', { query: '', cursor: malformed }), /Invalid catalog cursor/)
  }
  assert.throws(() => queryCatalog(plan, 'search_catalog', { limit: 500 }), /50/)
  assert.deepEqual(await operate('search_catalog', { query: 'MSRP' }, root), queryCatalog(plan, 'search_catalog', { query: 'MSRP' }))
})
test('exact details can be recovered without returning the component schema inventory', async t => {
  const { plan } = await fixture(t)
  const parts: any[] = []
  let cursor: string | undefined
  do { const page = queryCatalog(plan, 'get_catalog_entity', { id: msrp, limit: 2, cursor }); parts.push(...page.items); cursor = page.nextCursor ?? undefined } while (cursor)
  const serialized = JSON.stringify(parts)
  assert.match(serialized, /MsrpPriceRequest/)
  assert.doesNotMatch(serialized, /MsrpPriceItem/)
  assert.throws(() => queryCatalog(plan, 'get_catalog_entity', { id: msrp.replace('catalog/', 'other/') }), /not found/)
  const large = detailParts({ example: '🐈'.repeat(20000) })
  assert.equal(large.map(part => part.value).join(''), '🐈'.repeat(20000))
  assert.deepEqual(parseCatalogId(catalogId('p', 'c', 'schema', 'A/B')), { project: 'p', component: 'c', kind: 'schema', entity: 'A/B' })
})
test('uncommitted observation A remains readable after B replaces/removes it; immutable baseline rejects writes', async t => {
  const { root } = await fixture(t)
  let plan = await readPlan(root)
  await operate('create_feature', { id: 'pricing', title: 'Pricing change', productId: components[0].productId, ownerId: 'owner', problem: 'Investigate a price change', outcome: 'A justified plan', expectedRevision: plan.revision, expectedContext: plan.context.token }, root)
  plan = await readPlan(root)
  const saved = await retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'What is the MSRP entry point?', ids: [msrp], assumptions: ['Execution remains untraced.'], expectedRevision: plan.revision, expectedContext: plan.context.token })
  let baseline = await getDiscoveryBaseline(root, { featureId: 'pricing', baselineId: saved.baselineId })
  assert.equal(baseline.reassessmentRequired, false)
  plan = await readPlan(root)
  const component = JSON.parse(plan.files['components/gpe-price.json'])
  component.api.endpoints = component.api.endpoints.filter((item: any) => item.id !== 'post-api-v5-prices-calculate-msrp')
  await writePlan(root, { expectedRevision: plan.revision, expectedContext: plan.context.token, changes: { 'components/gpe-price.json': JSON.stringify(component) } })
  baseline = await getDiscoveryBaseline(root, { featureId: 'pricing', baselineId: saved.baselineId })
  assert.equal(baseline.baseline.observations[0].observation.name, 'Calculate MSRP')
  assert.equal(baseline.assessments[0].catalogState, 'removed')
  assert.equal(baseline.reassessmentRequired, true)
  plan = await readPlan(root)
  await assert.rejects(writePlan(root, { expectedRevision: plan.revision, expectedContext: plan.context.token, changes: { [saved.file]: null } }), /immutable/)
})
