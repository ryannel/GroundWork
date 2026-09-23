import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { gapArea, mergeComponent } from '../server/scan-baseline.ts'
import { retirementCascade } from '../server/scan-lifecycle.ts'
import { incrementalMode, planPackets, type FreshnessSummary } from '../server/scan-packets.ts'
import type { DetectedProject, InventoryFile } from '../server/scan-projects.ts'
import { redact } from '../server/scan-acquire.ts'
import { lineCount, repositoryKey, worstStatus } from '../server/catalog-freshness.ts'
import { repositoryDiscoverySchema, sourceRefSchema } from '../src/data/scan-schema.ts'
import { tempDir } from './helpers.ts'

const revision = 'a'.repeat(40)
const next = 'b'.repeat(40)
const file = (value: string): InventoryFile => ({ path: value, digest: revision, bytes: 1 })
const project = (value: string): DetectedProject => ({ path: value, name: value, suggestedId: value === '.' ? 'root' : value, manifest: 'package.json' })

test('planPackets splits lanes by maxFilesPerPacket and counts packets beyond maxPackets', () => {
  const files = ['package.json', 'src/routes.ts', 'src/route-a.ts', 'src/route-b.ts'].map(file)
  const base = { projects: [project('.')], files, outputDirectory: '/out' }
  const split = planPackets({ ...base, areas: ['api'], budgets: { maxFilesPerPacket: 2, maxPackets: 10 } })
  assert.equal(split.skipped, 0)
  assert.deepEqual(split.packets.map(packet => [packet.id.replace(/-[a-f0-9]{8}-/, '-'), packet.files.length, packet.availableFiles]), [
    ['root-api-part-1', 2, 4], ['root-api-part-2', 2, 4],
  ])
  assert.equal(split.packets[0].outputPath, path.join('/out', `${split.packets[0].id}.json`))
  const limited = planPackets({ ...base, areas: ['api', 'data'], budgets: { maxFilesPerPacket: 1, maxPackets: 2 } })
  assert.equal(limited.packets.length, 2)
  // api has 4 parts (2 skipped) and data has 1 (skipped): 3 packets are never created.
  assert.equal(limited.skipped, 3)
})

test('planPackets narrows incremental work to changed files and skips empty lanes', () => {
  const files = ['package.json', 'src/routes.ts', 'src/model.ts'].map(file)
  const base = { projects: [project('.')], files, areas: ['api' as const, 'data' as const], budgets: { maxFilesPerPacket: 10, maxPackets: 10 }, outputDirectory: '/out' }
  const changedPaths = new Set(['src/model.ts'])
  assert.deepEqual(planPackets({ ...base, incremental: { mode: 'unchanged', changedPaths } }).packets, [])
  assert.deepEqual(planPackets({ ...base, incremental: { mode: 'focused', changedPaths } }).packets.map(packet => packet.files), [['src/model.ts'], ['src/model.ts']])
  assert.deepEqual(planPackets({ ...base, incremental: { mode: 'broader-review', changedPaths } }).packets[0].files, ['package.json', 'src/routes.ts', 'src/model.ts'])
})

test('incrementalMode focuses only fully mapped changes on descendant history', () => {
  const assessment = { unmappedChanges: 0, broaderReviewChanges: { count: 0 }, invalidCitations: { count: 0 }, ancestry: 'same-or-descendant' }
  const report = (patch: Partial<FreshnessSummary> = {}, item = {}): FreshnessSummary =>
    ({ status: 'review-required', assessments: [{ ...assessment, ...item }], changes: [{ files: ['a.ts'], omittedFiles: 0 }], ...patch })
  assert.equal(incrementalMode(report({ status: 'unchanged-source-tree' })), 'unchanged')
  assert.equal(incrementalMode(report()), 'focused')
  assert.equal(incrementalMode(report({ status: 'impact-unknown' })), 'broader-review')
  assert.equal(incrementalMode(report({ status: 'unknown', changes: undefined })), 'broader-review')
  assert.equal(incrementalMode(report({ changes: [{ files: [], omittedFiles: 1 }] })), 'broader-review')
  assert.equal(incrementalMode(report({}, { unmappedChanges: 1 })), 'broader-review')
  assert.equal(incrementalMode(report({}, { ancestry: 'not-known-to-be-descendant' })), 'broader-review')
})

test('mergeComponent replaces only covered areas and downgrades completeness recorded at another revision', () => {
  const evidence = [{ path: 'package.json', lines: '1', claim: 'Depends on other.', revision }]
  const previous = {
    id: 'api', productId: 'app', name: 'API', order: 1, dependsOn: ['other'], evidence,
    gaps: [{ area: 'data', reason: 'Old data gap' }, { area: 'api.auth', reason: 'Old API gap' }, { area: 'general', reason: 'Component gap' }],
    scan: { status: 'complete' as const, revision, coverage: { dependencies: 'complete' as const, api: 'complete' as const, data: 'complete' as const, messaging: 'complete' as const } },
  }
  const discovery = repositoryDiscoverySchema.parse({
    id: 'api', productId: 'app', sourcePath: '.', name: 'API', coverage: { api: 'complete' },
    gaps: [{ area: 'api', reason: 'New API gap' }],
  })
  const context = { repository: 'acme/api', revision: next, order: 1, sourceFingerprint: 'f', scannedAt: new Date(0).toISOString() }
  const merged = mergeComponent(previous, discovery, context) as any
  assert.deepEqual(merged.dependsOn, ['other'])
  assert.deepEqual(merged.evidence, evidence)
  assert.deepEqual(merged.gaps.map((gap: any) => gap.reason), ['Old data gap', 'Component gap', 'New API gap'])
  assert.deepEqual(merged.scan.coverage, { dependencies: 'partial', api: 'complete', data: 'partial', messaging: 'partial' })
  assert.equal(merged.scan.status, 'partial')
  // At the same revision, completeness recorded by an earlier scan still holds.
  const same = mergeComponent(previous, discovery, { ...context, revision }) as any
  assert.equal(same.scan.status, 'complete')
  // A dependency rescan replaces dependency results and component evidence together.
  const dependencies = repositoryDiscoverySchema.parse({ id: 'api', productId: 'app', sourcePath: '.', name: 'API', coverage: { dependencies: 'complete' } })
  const replaced = mergeComponent(previous, dependencies, context) as any
  assert.deepEqual([replaced.dependsOn, replaced.evidence], [[], []])
  assert.deepEqual(replaced.gaps.map((gap: any) => gap.reason), ['Old data gap', 'Old API gap'])
})

test('gapArea reads the area prefix and treats other gaps as component-level', () => {
  assert.deepEqual(['api', 'API.auth', 'messaging/delivery', 'data:ttl', 'apis', 'general'].map(gapArea), ['api', 'api', 'messaging', 'data', 'dependencies', 'dependencies'])
})

test('retirementCascade retires every active flow that depends on a retired observation', () => {
  const step = (patch = {}) => ({ id: 's', title: 'S', kind: 'logic' as const, description: 'D', evidence: [], ...patch })
  const flow = (id: string, patch = {}, steps = [step()]) =>
    ({ id, name: id, summary: id, sourceRevision: revision, entryStepId: 's', steps, transitions: [], gaps: [], ...patch })
  const component = { executionFlows: [
    flow('by-endpoint', { endpointId: 'read' }),
    flow('by-message', { trigger: { kind: 'message' as const, messageId: 'created' } }),
    flow('publishes', {}, [step({ messageIds: ['created'] })]),
    flow('by-data', {}, [step({ dataRecordIds: ['orders'] })]),
    flow('by-job', { trigger: { kind: 'job' as const, jobId: 'nightly' } }),
    flow('unrelated', { endpointId: 'write' }),
  ] }
  const retire = (kind: 'endpoint' | 'message' | 'data' | 'job' | 'schema', id: string) => ({ kind, id, reason: 'Removed', evidence: [] })
  const ids = (actions: { kind: string; id: string }[]) => actions.map(action => `${action.kind}/${action.id}`)
  assert.deepEqual(ids(retirementCascade(component, [retire('endpoint', 'read')])), ['endpoint/read', 'flow/by-endpoint'])
  assert.deepEqual(ids(retirementCascade(component, [retire('message', 'created')])), ['message/created', 'flow/by-message', 'flow/publishes'])
  assert.deepEqual(ids(retirementCascade(component, [retire('data', 'orders')])), ['data/orders', 'flow/by-data'])
  assert.deepEqual(ids(retirementCascade(component, [retire('job', 'nightly')])), ['job/nightly', 'flow/by-job'])
  assert.deepEqual(ids(retirementCascade(component, [retire('schema', 'item')])), ['schema/item'])
  const cascaded = retirementCascade(component, [retire('endpoint', 'read')])[1]
  assert.match(cascaded.reason, /because endpoint\/read was retired: Removed/)
})

test('sourceRef accepts branches, tags and hashes but never options or revision expressions', () => {
  for (const ref of ['main', 'release/1.2', 'v1.0.0', 'HEAD', 'a'.repeat(40), 'b'.repeat(64)]) assert.equal(sourceRefSchema.parse(ref), ref)
  for (const ref of ['--upload-pack=touch x', '-c', 'main..dev', 'HEAD~1', 'HEAD^', 'a:b', 'x y', 'main@{1}', 'x\\y', '']) {
    assert.equal(sourceRefSchema.safeParse(ref).success, false, ref)
  }
})

test('redact removes URL credentials from command errors', () => {
  assert.equal(redact('Command failed: git clone -- https://x-access-token:ghs_SECRET@github.com/acme/api.git /tmp/x'),
    'Command failed: git clone -- https://github.com/acme/api.git /tmp/x')
})

test('lineCount does not count the empty string after a trailing newline', () => {
  assert.deepEqual(['', 'a', 'a\n', 'a\r\nb', 'a\nb\n', '\n'].map(lineCount), [0, 1, 1, 2, 2, 1])
})

test('worstStatus orders unknown above review-required above impact-unknown above unchanged', () => {
  assert.equal(worstStatus(['impact-unknown', 'unknown', 'review-required'], 'unchanged-source-tree'), 'unknown')
  assert.equal(worstStatus(['impact-unknown', 'review-required'], 'unchanged-source-tree'), 'review-required')
  assert.equal(worstStatus([], 'unchanged-source-tree'), 'unchanged-source-tree')
  assert.equal(worstStatus(['unchanged-source-tree'], 'unchecked'), 'unchanged-source-tree')
})

test('repositoryKey folds GitHub forms together and resolves local symlinks', async t => {
  const keys = await Promise.all(['github.com/Acme/Api', 'https://GitHub.com/acme/api.git', 'git@github.com:acme/api.git', 'Acme/Api'].map(repositoryKey))
  assert.deepEqual(new Set(keys), new Set(['acme/api']))
  const base = await tempDir(t, 'groundwork-key-')
  await symlink(base, `${base}-link`)
  t.after(() => rm(`${base}-link`, { force: true }))
  assert.equal(await repositoryKey(`${base}-link`), await repositoryKey(base))
})
