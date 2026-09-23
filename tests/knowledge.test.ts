import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { initialise } from '../server/setup.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { git } from '../server/git.ts'
import type { compareCatalogSources } from '../server/catalog-freshness.ts'
import { operate } from '../server/operations.ts'
import { Conflict, NotFound } from '../server/errors.ts'
import { assessFeatureDiscovery, getDiscoveryBaseline, retainDiscoveryBaseline } from '../server/knowledge.ts'
import { catalogId, parseCatalogId } from '../src/data/catalog-identity.ts'
import { catalogFiles, components, msrpEndpoint } from './fixtures/catalog.ts'
import { guard, sourceCatalogFixture, tempDir } from './helpers.ts'

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

test('feature reassessment checks retained source facts even after catalog refresh and preserves unrelated plans', async t => {
  const f = await sourceCatalogFixture(t)
  let p = await readPlan(f.target)
  const feature = { id: 'change', title: 'Pricing change', productId: 'app', ownerId: 'owner', problem: 'Need changed behavior.', outcome: 'Validated new behavior.' }
  await operate('create_feature', { ...feature, ...guard(p) }, f.target)
  p = await readPlan(f.target)
  const baseline = await retainDiscoveryBaseline(f.target, { featureId: 'change', question: 'Which contract is affected?', ids: [f.ids[0]], ...guard(p) })
  const sources = [{ repositoryPath: f.source, targetRef: 'HEAD', ids: [f.ids[0]] }]
  p = await readPlan(f.target)
  const beforeRaw = p.files[`features/change/baselines/${baseline.baselineId}.json`]
  // An unrelated component update does not invalidate this observation.
  await writePlan(f.target, { ...guard(p), changes: { 'components/other.json': JSON.stringify({ id: 'other', name: 'Other', productId: 'app' }) } })
  p = await readPlan(f.target)
  const clear = await assessFeatureDiscovery(f.target, { featureId: 'change', baselineId: baseline.baselineId, ...guard(p) })
  assert.equal(clear.assessment.reassessmentRequired, false)
  assert.equal(clear.assessment.observations[0].sourceFreshness, 'unchecked')
  await f.commit('handler.ts', 'callHelper(3)\n')
  const target = await git(f.source, ['rev-parse', 'HEAD'])
  p = await readPlan(f.target)
  await assessFeatureDiscovery(f.target, { featureId: 'change', baselineId: baseline.baselineId, ...guard(p), sources })
  const sourceOnly = await getDiscoveryBaseline(f.target, { featureId: 'change', baselineId: baseline.baselineId })
  assert.equal(sourceOnly.assessments[0].catalogState, 'unchanged')
  assert.equal(sourceOnly.reassessmentRequired, true)
  assert.equal(sourceOnly.lastSourceAssessment!.targets[0].targetRevision, target)
  f.component.api.endpoints[0].evidence[0].revision = target
  p = await readPlan(f.target)
  await writePlan(f.target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(f.component) } })
  p = await readPlan(f.target)
  const checked = await assessFeatureDiscovery(f.target, { featureId: 'change', baselineId: baseline.baselineId, ...guard(p), sources })
  assert.equal(checked.assessment.reassessmentRequired, true)
  assert.equal(checked.assessment.observations[0].sourceFreshness, 'review-required')
  const check = checked.assessment.checks[0] as Awaited<ReturnType<typeof compareCatalogSources>>
  assert.equal(check.assessments[0].observedRevision, f.revision)
  assert.equal(check.targetRevision, target)
  const after = await readPlan(f.target)
  assert.equal(after.files[`features/change/baselines/${baseline.baselineId}.json`], beforeRaw)
  assert.ok(after.files[`features/change/assessments/${checked.assessmentId}.json`])
})
