import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { operate } from '../server/operations.ts'
import { Conflict, NotFound } from '../server/errors.ts'
import { assessFeatureDiscovery, getDiscoveryBaseline, retainDiscoveryBaseline } from '../server/knowledge.ts'
import { catalogId } from '../src/data/catalog-identity.ts'

const components = JSON.parse(await readFile(new URL('./fixtures/catalog/components.json', import.meta.url), 'utf8'))
const products = JSON.parse(await readFile(new URL('./fixtures/catalog/products.json', import.meta.url), 'utf8'))
const msrp = catalogId('catalog', 'gpe-price', 'endpoint', 'post-api-v5-prices-calculate-msrp')

async function fixture(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-knowledge-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { files: {
    'project.json': JSON.stringify({ schemaVersion: 2, id: 'catalog', name: 'Catalog evaluation' }),
    'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
    ...Object.fromEntries(products.map((p: any) => [`products/${p.id}.json`, JSON.stringify(p)])),
    ...Object.fromEntries(components.map((c: any) => [`components/${c.id}.json`, JSON.stringify(c)])),
  } })
  const plan = await readPlan(root)
  const guard = { expectedRevision: plan.revision, expectedContext: plan.context.token }
  await operate('create_feature', { ...guard, id: 'pricing', title: 'Pricing', productId: components[0].productId, ownerId: 'owner', problem: 'P', outcome: 'O' }, root)
  return { root, stale: guard }
}
const guard = async (root: string) => { const plan = await readPlan(root); return { expectedRevision: plan.revision, expectedContext: plan.context.token } }

test('stale baseline and assessment requests are conflicts; unknown baselines are not found', async t => {
  const { root, stale } = await fixture(t)
  await assert.rejects(retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'Q', ids: [msrp], ...stale }), Conflict)
  const saved = await retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'Q', ids: [msrp], ...await guard(root) })
  await assert.rejects(assessFeatureDiscovery(root, { featureId: 'pricing', baselineId: saved.baselineId, ...stale }), Conflict)
  await assert.rejects(getDiscoveryBaseline(root, { featureId: 'pricing', baselineId: 'f'.repeat(64) }), NotFound)
  await assert.rejects(retainDiscoveryBaseline(root, { featureId: 'missing', question: 'Q', ids: [msrp], ...await guard(root) }), NotFound)
})

test('a retained baseline stores typed relations and compares unchanged until the catalog changes', async t => {
  const { root } = await fixture(t)
  const saved = await retainDiscoveryBaseline(root, { featureId: 'pricing', question: 'Q', ids: [msrp], ...await guard(root) })
  const read = await getDiscoveryBaseline(root, { featureId: 'pricing', baselineId: saved.baselineId })
  assert.ok(read.baseline.observations[0].relations.every(relation => relation.kind && typeof relation.reverse === 'boolean'))
  assert.equal(read.assessments[0].catalogState, 'unchanged')
  const assessed = await assessFeatureDiscovery(root, { featureId: 'pricing', baselineId: saved.baselineId, ...await guard(root) })
  assert.equal(assessed.assessment.reassessmentRequired, false)
})
