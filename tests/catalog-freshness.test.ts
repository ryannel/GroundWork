import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { TestContext } from 'node:test'
import type { z } from 'zod'
import type { executionFlowSchema } from '../src/data/content-schema.ts'
import { git } from '../server/git.ts'
import { initialise } from '../server/setup.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { checkCatalogFreshness, type compareCatalogSources } from '../server/catalog-freshness.ts'
import { applyCatalogInvestigation, applyRepositoryScan, discardRepositoryScan, prepareRepositoryScan, reconcileCatalog } from '../server/scanner.ts'
import { assessFeatureDiscovery, getDiscoveryBaseline, retainDiscoveryBaseline } from '../server/knowledge.ts'
import { readScanManifest, type ManifestScope } from '../server/scan-manifests.ts'
import { catalogId } from '../src/data/catalog-identity.ts'
import { operate } from '../server/operations.ts'
import { commitAll, gitInit, guard, tempDir } from './helpers.ts'

async function fixture(t: TestContext) {
  const base = await tempDir(t, 'groundwork-freshness-')
  const source = await gitInit(path.join(base, 'source')), target = path.join(base, 'catalog')
  for (const [file, text] of Object.entries({ 'handler.ts': 'callHelper()\n', 'helper.ts': 'return 1\n', 'unmapped.ts': 'return true\n', 'package-lock.json': '{"version":1}\n' })) await writeFile(path.join(source, file), text)
  const revision = await commitAll(source, 'Observed source')
  await initialise(target, { id: 'freshness', name: 'Freshness' })
  const p = await readPlan(target)
  const component = { id: 'service', productId: 'app', name: 'Service', repo: source, sourceRevision: revision,
    api: { name: 'API', endpoints: [{ id: 'read', name: 'Read', method: 'GET', path: '/read', source: 'handler.ts', evidence: [{ path: 'handler.ts', lines: '1', revision, claim: 'Calls helper.' }] }] },
    executionFlows: [{ id: 'read-flow', endpointId: 'read', name: 'Read flow', summary: 'Handler uses helper.', sourceRevision: revision, entryStepId: 'helper', steps: [{ id: 'helper', title: 'Helper', kind: 'logic', description: 'Helper returns a value.', evidence: [{ path: 'helper.ts', lines: '1', revision, claim: 'Returns a value.' }] }], transitions: [], gaps: [] }],
  }
  await writePlan(target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(component) } })
  const ids = [catalogId('freshness', 'service', 'endpoint', 'read'), catalogId('freshness', 'service', 'flow', 'read-flow')]
  const check = (patch = {}) => checkCatalogFreshness(target, { repositoryPath: source, targetRef: 'HEAD', ids, ...patch })
  const commit = async (file: string, value: string) => { await writeFile(path.join(source, file), value); await commitAll(source, 'Changed source') }
  return { source, target, revision, component, ids, check, commit }
}
test('unchanged trees are scoped source evidence; working tree edits are excluded', async t => {
  const f = await fixture(t)
  await writeFile(path.join(f.source, 'handler.ts'), 'uncommitted change\n')
  const result = await f.check()
  assert.equal(result.status, 'unchanged-source-tree')
  assert.equal(result.behavioralVerification, 'not-performed')
  assert.equal(result.persisted, false)
  assert.match(result.scope, /Working-tree changes.*excluded/)
  assert.ok(result.assessments.every(a => a.citationIntegrity === 'checked-at-observation'))
  const routed = await operate('check_catalog_freshness', { repositoryPath: f.source, targetRef: f.revision, ids: f.ids }, f.target) as
    Awaited<ReturnType<typeof checkCatalogFreshness>>
  assert.equal(routed.targetRevision, f.revision)
})
test('a changed known helper widens review while an unchanged handler retains unknown impact', async t => {
  const f = await fixture(t)
  await f.commit('helper.ts', 'return 2\n')
  const result = await f.check()
  assert.equal(result.status, 'review-required')
  assert.equal(result.assessments[0].status, 'impact-unknown')
  assert.equal(result.assessments[1].status, 'review-required')
  assert.deepEqual(result.assessments[1].knownImpact.paths, ['helper.ts'])
})
test('unmapped source changes never produce verified-current; lockfiles require wider review', async t => {
  const f = await fixture(t)
  await f.commit('unmapped.ts', 'return false\n')
  assert.equal((await f.check()).status, 'impact-unknown')
  await f.commit('package-lock.json', '{"version":2}\n')
  const result = await f.check({ maxFiles: 0 })
  assert.equal(result.status, 'review-required')
  assert.ok(result.assessments.every(a => a.broaderReviewChanges.paths.includes('package-lock.json')))
  assert.ok('changes' in result)
  assert.equal(result.changes[0].omittedFiles, 2)
  assert.deepEqual(result.changes[0].files, [])
})
test('deleted/renamed citations require review and invalid original citations are identified', async t => {
  const f = await fixture(t)
  await git(f.source, ['mv', 'handler.ts', 'renamed.ts']); await git(f.source, ['commit', '-am', 'Rename'])
  let result = await f.check()
  assert.equal(result.assessments[0].status, 'review-required')
  assert.ok('changes' in result)
  assert.ok(result.changes[0].files.includes('handler.ts'))
  assert.ok(result.changes[0].files.includes('renamed.ts'))
  const p = await readPlan(f.target)
  f.component.api.endpoints[0].evidence[0].lines = '999'
  await writePlan(f.target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(f.component) } })
  result = await f.check()
  assert.equal(result.assessments[0].citationIntegrity, 'invalid')
})
test('unavailable history, target, and mismatched repository fail closed with explicit uncertainty', async t => {
  const f = await fixture(t)
  assert.equal((await f.check({ targetRef: 'does-not-exist' })).status, 'unknown')
  assert.equal((await f.check({ repositoryPath: f.target })).status, 'unknown')
  const p = await readPlan(f.target)
  f.component.api.endpoints[0].evidence[0].revision = 'a'.repeat(40)
  await writePlan(f.target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(f.component) } })
  assert.equal((await f.check()).assessments[0].status, 'unknown')
})

test('incremental preparation pins a narrowed work queue and prevents inventory replacement', async t => {
  const f = await fixture(t)
  await f.commit('handler.ts', 'callHelper(2)\n')
  const before = await readPlan(f.target)
  const prepared = await prepareRepositoryScan(f.target, {
    repository: f.source, sourceRef: 'HEAD', areas: ['api'], incremental: { ids: [f.ids[0]] },
  })
  t.after(() => discardRepositoryScan({ scanId: prepared.scanId }))
  let applied: Awaited<ReturnType<typeof applyCatalogInvestigation>>
  let after: Awaited<ReturnType<typeof readPlan>>

  await t.test('preparation narrows the work queue to changed files at the pinned revision', async () => {
    assert.equal(prepared.incremental?.mode, 'focused')
    assert.equal(prepared.revision, await git(f.source, ['rev-parse', 'HEAD']))
    assert.deepEqual(prepared.packets.flatMap(packet => packet.files), ['handler.ts'])
    assert.equal(await readFile(path.join(prepared.sourcePath, 'helper.ts'), 'utf8'), 'return 1\n')
  })
  await t.test('an incremental scan cannot replace catalog inventories', async () => {
    const discoveries = [{ id: 'service', productId: 'app', sourcePath: '.', name: 'Service', coverage: { api: 'complete' as const } }]
    await assert.rejects(applyRepositoryScan(f.target, { scanId: prepared.scanId, ...guard(before), discoveries }), /cannot replace catalog inventories/)
    assert.equal((await readPlan(f.target)).revision, before.revision)
  })
  await t.test('a focused investigation refreshes flows and leaves the API untouched', async () => {
    const flow = structuredClone(f.component.executionFlows[0])
    flow.sourceRevision = prepared.revision
    flow.steps[0].evidence[0].revision = prepared.revision
    applied = await applyCatalogInvestigation(f.target, { scanId: prepared.scanId, componentId: 'service', ...guard(before), flows: [flow] })
    after = await readPlan(f.target)
    assert.deepEqual(after.snapshot.components[0].api, before.snapshot.components[0].api)
    assert.equal(after.snapshot.components[0].executionFlows![0].sourceRevision, prepared.revision)
  })
  await t.test('the retained manifest lists, pages and maps its sections', async () => {
    const listing = await readScanManifest(f.target, {})
    assert.equal(listing.total, 1)
    assert.equal((listing.items[0] as { manifestId: string }).manifestId, applied.manifestId)
    const fingerprints = await readScanManifest(f.target, { manifestId: applied.manifestId, section: 'dependencyFingerprints' })
    assert.ok((fingerprints.items as { path: string }[]).some(file => file.path === 'package-lock.json'))
    const files = await readScanManifest(f.target, { manifestId: applied.manifestId, section: 'files', limit: 1 })
    assert.equal(files.items.length, 1)
    assert.equal(files.nextOffset, 1)
    const mappings = await readScanManifest(f.target, { manifestId: applied.manifestId, section: 'mappings' })
    assert.ok((mappings.items as { entityId: string; path: string }[]).some(item => item.entityId === f.ids[1] && item.path === 'helper.ts'))
  })
  await t.test('manifests are immutable and content-addressed', async () => {
    const name = `scan-manifests/${applied.manifestId}.json`
    await assert.rejects(writePlan(f.target, { ...guard(after), changes: { [name]: null } }), /immutable/)
    const forged = { [`scan-manifests/${'0'.repeat(64)}.json`]: after.files[name] }
    await assert.rejects(writePlan(f.target, { ...guard(after), changes: forged }), /hash mismatch/)
  })
  await t.test('paging needs the catalog revision and fails once the catalog moves on', async () => {
    await assert.rejects(readScanManifest(f.target, { offset: 1 }), /expectedRevision/)
    await assert.rejects(readScanManifest(f.target, { expectedRevision: before.revision }), /Catalog changed/)
  })
  await t.test('manifests can be read at a historical ref', async () => {
    const files = await readScanManifest(f.target, { manifestId: applied.manifestId, section: 'files' })
    await gitInit(f.target)
    await git(f.target, ['add', '.groundwork/plans'])
    await git(f.target, ['commit', '-q', '-m', 'Retained manifest'])
    const historical = await readScanManifest(f.target, { manifestId: applied.manifestId, section: 'files' }, 'HEAD')
    assert.equal(historical.total, files.total)
  })
})

test('incremental preparation expands for new entry points and excluded dependency changes', async t => {
  const f = await fixture(t)
  await f.commit('new-controller.ts', 'export const route = "/new"\n')
  await f.commit('package-lock.json', '{"version":2}\n')
  const prepared = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD', areas: ['api'], incremental: { ids: f.ids } })
  t.after(() => discardRepositoryScan({ scanId: prepared.scanId }))
  assert.equal(prepared.incremental?.mode, 'broader-review')
  assert.ok(prepared.packets.some(packet => packet.files.includes('new-controller.ts')))
  assert.ok(prepared.packets.some(packet => packet.files.includes('helper.ts')))
  assert.ok(prepared.incremental?.report.assessments.some(item => item.broaderReviewChanges.paths.includes('package-lock.json')))
})

test('unchanged incremental preparation creates no extraction work and requires an explicit target', async t => {
  const f = await fixture(t)
  await assert.rejects(prepareRepositoryScan(f.target, { repository: f.source, incremental: { ids: f.ids } }), /explicit sourceRef/)
  const prepared = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD', incremental: { ids: f.ids } })
  t.after(() => discardRepositoryScan({ scanId: prepared.scanId }))
  assert.equal(prepared.incremental?.mode, 'unchanged')
  assert.deepEqual(prepared.packets, [])
  assert.match(prepared.applyPolicy!, /No observations have been refreshed/)
})

test('incremental deletion review retains missing paths and missing history widens work', async t => {
  const f = await fixture(t)
  await git(f.source, ['rm', 'handler.ts'])
  await git(f.source, ['commit', '-m', 'Remove handler'])
  const deleted = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD', incremental: { ids: [f.ids[0]] } })
  t.after(() => discardRepositoryScan({ scanId: deleted.scanId }))
  assert.deepEqual(deleted.changedPathsOutsideSnapshot, ['handler.ts'])
  assert.equal(deleted.incremental?.report.status, 'review-required')
  const p = await readPlan(f.target)
  f.component.api.endpoints[0].evidence[0].revision = 'a'.repeat(40)
  await writePlan(f.target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(f.component) } })
  const unknown = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD', areas: ['api'], incremental: { ids: [f.ids[0]] } })
  t.after(() => discardRepositoryScan({ scanId: unknown.scanId }))
  assert.equal(unknown.incremental?.mode, 'broader-review')
  assert.equal(unknown.incremental?.report.status, 'unknown')
  assert.ok(unknown.packets.some(packet => packet.files.includes('helper.ts')))
})

test('evidenced lifecycle changes preserve identities and retained facts while retiring dependent flows', async t => {
  const f = await fixture(t)
  let p = await readPlan(f.target)
  await operate('create_feature', { id: 'change', title: 'Change read contract', productId: 'app', ownerId: 'owner', problem: 'Read needs a new name.', outcome: 'The consumer uses the new name.', ...guard(p) }, f.target)
  p = await readPlan(f.target)
  const baseline = await retainDiscoveryBaseline(f.target, { featureId: 'change', question: 'What read contract exists?', ids: f.ids, ...guard(p) })
  await f.commit('handler.ts', '// Route renamed to /read-next\ncallHelper()\n')
  let scan = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD' })
  p = await readPlan(f.target)
  const evidence = [{ path: 'handler.ts', lines: '1', claim: 'Route rename is recorded.', revision: scan.revision }]
  await reconcileCatalog(f.target, { scanId: scan.scanId, componentId: 'service', ...guard(p), rename: [{ kind: 'endpoint', id: 'read', name: 'Read next', path: '/read-next', evidence }] })
  p = await readPlan(f.target)
  assert.equal(p.snapshot.components[0].api!.endpoints[0].id, 'read')
  assert.equal(p.snapshot.components[0].executionFlows![0].endpointId, 'read')
  assert.equal(p.snapshot.components[0].catalogChanges![0].nameBefore, 'Read')
  await f.commit('handler.ts', '// The read route has been removed.\n')
  scan = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD' })
  p = await readPlan(f.target)
  await reconcileCatalog(f.target, { scanId: scan.scanId, componentId: 'service', ...guard(p), retire: [{ kind: 'endpoint', id: 'read', reason: 'Inspected removal of the route.', evidence: [{ ...evidence[0], revision: scan.revision, claim: 'Route removed.' }] }] })
  const after = await readPlan(f.target), c = after.snapshot.components[0]
  assert.deepEqual(c.api!.endpoints, [])
  assert.deepEqual(c.executionFlows, [])
  assert.equal(c.retiredObservations!.length, 2)
  assert.equal(c.retiredObservations!.find(item => item.kind === 'flow')!.observation.sourceRevision, f.revision)
  const retained = await getDiscoveryBaseline(f.target, { featureId: 'change', baselineId: baseline.baselineId })
  assert.ok(retained.reassessmentRequired)
  assert.ok(retained.assessments.every(item => item.catalogState === 'removed'))
  assert.equal(retained.baseline.observations[0].observation.name, 'Read')
  await assert.rejects(writePlan(f.target, { ...guard(after), changes: { 'components/service.json': JSON.stringify({ ...c, api: f.component.api }) } }), /Retired identity is still active/)
})

test('feature reassessment checks retained source facts even after catalog refresh and preserves unrelated plans', async t => {
  const f = await fixture(t)
  let p = await readPlan(f.target)
  await operate('create_feature', { id: 'change', title: 'Pricing change', productId: 'app', ownerId: 'owner', problem: 'Need changed behavior.', outcome: 'Validated new behavior.', ...guard(p) }, f.target)
  p = await readPlan(f.target)
  const baseline = await retainDiscoveryBaseline(f.target, { featureId: 'change', question: 'Which contract is affected?', ids: [f.ids[0]], ...guard(p) })
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
  await assessFeatureDiscovery(f.target, { featureId: 'change', baselineId: baseline.baselineId, ...guard(p), sources: [{ repositoryPath: f.source, targetRef: 'HEAD', ids: [f.ids[0]] }] })
  const sourceOnly = await getDiscoveryBaseline(f.target, { featureId: 'change', baselineId: baseline.baselineId })
  assert.equal(sourceOnly.assessments[0].catalogState, 'unchanged')
  assert.equal(sourceOnly.reassessmentRequired, true)
  assert.equal(sourceOnly.lastSourceAssessment!.targets[0].targetRevision, target)
  f.component.api.endpoints[0].evidence[0].revision = target
  p = await readPlan(f.target)
  await writePlan(f.target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(f.component) } })
  p = await readPlan(f.target)
  const checked = await assessFeatureDiscovery(f.target, { featureId: 'change', baselineId: baseline.baselineId, ...guard(p), sources: [{ repositoryPath: f.source, targetRef: 'HEAD', ids: [f.ids[0]] }] })
  assert.equal(checked.assessment.reassessmentRequired, true)
  assert.equal(checked.assessment.observations[0].sourceFreshness, 'review-required')
  const check = checked.assessment.checks[0] as Awaited<ReturnType<typeof compareCatalogSources>>
  assert.equal(check.assessments[0].observedRevision, f.revision)
  assert.equal(check.targetRevision, target)
  const after = await readPlan(f.target)
  assert.equal(after.files[`features/change/baselines/${baseline.baselineId}.json`], beforeRaw)
  assert.ok(after.files[`features/change/assessments/${checked.assessmentId}.json`])
})

test('cross-repository citations require pinned snapshots and freshness checks preserve source identity', async t => {
  const f = await fixture(t), shared = await fixture(t)
  await shared.commit('helper.ts', 'return 99\n')
  const main = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD' })
  const secondary = await prepareRepositoryScan(f.target, { repository: shared.source, sourceRef: 'HEAD' })
  const p = await readPlan(f.target)
  const flow = structuredClone(f.component.executionFlows[0]) as z.infer<typeof executionFlowSchema>
  flow.steps.push({ id: 'shared', title: 'Shared helper', kind: 'dependency', description: 'Read a shared helper at its own pinned revision.', evidence: [{ repository: secondary.repository, path: 'helper.ts', lines: '1', claim: 'Shared return value.', revision: secondary.revision }] })
  flow.transitions.push({ id: 'call', from: 'helper', to: 'shared', label: 'Follow shared dependency', mode: 'sync', evidence: flow.steps[0].evidence })
  const input = { scanId: main.scanId, componentId: 'service', ...guard(p), flows: [flow] }
  await assert.rejects(applyCatalogInvestigation(f.target, input), /matching pinned sourceScans/)
  const applied = await applyCatalogInvestigation(f.target, { ...input, sourceScans: [secondary.scanId] })
  assert.equal(applied.supportingManifestIds.length, 1)
  // A supporting scan is borrowed, not consumed, and its manifest names only the cited project and observation.
  await access(secondary.sourcePath)
  await assert.rejects(access(main.sourcePath))
  const supportingManifest = (await readScanManifest(f.target, { manifestId: applied.supportingManifestIds[0] })).items[0] as { scope: ManifestScope[] }
  assert.deepEqual(supportingManifest.scope, [{ componentId: 'service', sourcePath: '.', areas: [], observationIds: [f.ids[1]] }])
  await discardRepositoryScan({ scanId: secondary.scanId })
  const primaryCheck = await f.check({ ids: [f.ids[1]] })
  assert.equal(primaryCheck.assessments[0].citationIntegrity, 'checked-at-observation')
  assert.equal(primaryCheck.assessments[0].otherRepositoryCount, 1)
  assert.equal(primaryCheck.status, 'impact-unknown')
  const sharedCheck = await f.check({ ids: [f.ids[1]], repository: secondary.repository, repositoryPath: shared.source })
  assert.equal(sharedCheck.assessments[0].citationIntegrity, 'checked-at-observation')
  assert.equal(sharedCheck.targetRevision, secondary.revision)
  assert.equal(sharedCheck.changes![0].observedRevision, secondary.revision)
})
