import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'
import type { executionFlowSchema } from '../src/data/content-schema.ts'
import { git } from '../server/git.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import type { checkCatalogFreshness } from '../server/catalog-freshness.ts'
import { applyCatalogInvestigation, discardRepositoryScan, prepareRepositoryScan as prepareRepositoryScanRaw } from '../server/scanner.ts'
import { readScanManifest, type ManifestScope } from '../server/scan-manifests.ts'
import { operate } from '../server/operations.ts'
import { guard, sourceCatalogFixture } from './helpers.ts'

const prepareRepositoryScan = (root: string, input: Record<string, unknown>) =>
  prepareRepositoryScanRaw(root, { destination: 'local', ...input })

test('unchanged trees are scoped source evidence; working tree edits are excluded', async t => {
  const f = await sourceCatalogFixture(t)
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
  const f = await sourceCatalogFixture(t)
  await f.commit('helper.ts', 'return 2\n')
  const result = await f.check()
  assert.equal(result.status, 'review-required')
  assert.equal(result.assessments[0].status, 'impact-unknown')
  assert.equal(result.assessments[1].status, 'review-required')
  assert.deepEqual(result.assessments[1].knownImpact.paths, ['helper.ts'])
})
test('unmapped source changes never produce verified-current; lockfiles require wider review', async t => {
  const f = await sourceCatalogFixture(t)
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
  const f = await sourceCatalogFixture(t)
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
  const f = await sourceCatalogFixture(t)
  assert.equal((await f.check({ targetRef: 'does-not-exist' })).status, 'unknown')
  assert.equal((await f.check({ repositoryPath: f.target })).status, 'unknown')
  const p = await readPlan(f.target)
  f.component.api.endpoints[0].evidence[0].revision = 'a'.repeat(40)
  await writePlan(f.target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(f.component) } })
  assert.equal((await f.check()).assessments[0].status, 'unknown')
})

test('cross-repository citations require pinned snapshots and freshness checks preserve source identity', async t => {
  const f = await sourceCatalogFixture(t), shared = await sourceCatalogFixture(t)
  await shared.commit('helper.ts', 'return 99\n')
  const main = await prepareRepositoryScan(f.target, { repository: f.source, sourceRef: 'HEAD' })
  const secondary = await prepareRepositoryScan(f.target, { repository: shared.source, sourceRef: 'HEAD' })
  const p = await readPlan(f.target)
  const flow = structuredClone(f.component.executionFlows[0]) as z.infer<typeof executionFlowSchema>
  flow.steps.push({
    id: 'shared', title: 'Shared helper', kind: 'dependency', description: 'Read a shared helper at its own pinned revision.',
    evidence: [{ repository: secondary.repository, path: 'helper.ts', lines: '1', claim: 'Shared return value.', revision: secondary.revision }],
  })
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
