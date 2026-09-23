import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { operate } from '../server/operations.ts'
import { Conflict, NotFound } from '../server/errors.ts'
import { assessFeatureDiscovery, getDiscoveryBaseline, retainDiscoveryBaseline } from '../server/knowledge.ts'
import { catalogId, parseCatalogId } from '../src/data/catalog-identity.ts'
import { catalogFiles, components, msrpEndpoint } from './fixtures/catalog.ts'
import { guard, tempDir } from './helpers.ts'

const msrp = catalogId('catalog', 'price-service', 'endpoint', msrpEndpoint)

async function fixture(t: TestContext) {
  const root = await tempDir(t, 'groundwork-knowledge-')
  await initialise(root, { files: catalogFiles })
  const stale = guard(await readPlan(root))
  await operate('create_feature', { ...stale, id: 'pricing', title: 'Pricing', productId: components[0].productId, ownerId: 'owner', problem: 'P', outcome: 'O' }, root)
  return { root, stale }
}
const current = async (root: string) => guard(await readPlan(root))

test('stale baseline and assessment requests are conflicts; unknown baselines are not found', async t => {
  const { root, stale } = await fixture(t)
  await assert.rejects(retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'Q', ids: [msrp], ...stale }), Conflict)
  const saved = await retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'Q', ids: [msrp], ...await current(root) })
  await assert.rejects(assessFeatureDiscovery(root, { featureId: 'pricing', baselineId: saved.baselineId, ...stale }), Conflict)
  await assert.rejects(getDiscoveryBaseline(root, { featureId: 'pricing', baselineId: 'f'.repeat(64) }), NotFound)
  await assert.rejects(retainDiscoveryBaseline(root, { featureId: 'missing', question: 'Q', ids: [msrp], ...await current(root) }), NotFound)
})

test('a retained baseline stores typed relations and compares unchanged until the catalog changes', async t => {
  const { root } = await fixture(t)
  const saved = await retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'Q', ids: [msrp], ...await current(root) })
  const read = await getDiscoveryBaseline(root, { featureId: 'pricing', baselineId: saved.baselineId })
  assert.ok(read.baseline.observations[0].relations.every(relation => relation.kind && typeof relation.reverse === 'boolean'))
  assert.equal(read.assessments[0].catalogState, 'unchanged')
  const assessed = await assessFeatureDiscovery(root, { featureId: 'pricing', baselineId: saved.baselineId, ...await current(root) })
  assert.equal(assessed.assessment.reassessmentRequired, false)
})
test('malformed percent-encoding in a catalog ID is an invalid ID, not a URIError', () => {
  assert.throws(() => parseCatalogId('p/c/endpoint/%E0%A4%A'), { message: 'Invalid catalog ID' })
})
