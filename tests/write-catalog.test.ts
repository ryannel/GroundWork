import { test } from 'node:test'
import assert from 'node:assert/strict'
import { operate } from '../server/operations.ts'
import { readCatalogTarget, readPlan } from '../server/repository.ts'
import { commitAll, homeFixture, writeFiles } from './helpers.ts'

const observedAt = '2026-09-25T12:00:00Z'
const emptyGaps = { dependencies: [], api: [], data: [], messaging: [], jobs: [], flows: [] }

test('write_catalog replaces one cited component with a guarded atomic write', async t => {
  const root = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  await writeFiles(root, { 'src/service.ts': 'export function service() {\n  return true\n}\n' })
  const revision = await commitAll(root, 'Observed source')
  const target = await readCatalogTarget(root, 'volvo-cars/price-engine', 'source')
  const component = {
    id: 'new-service', name: 'New service', repo: 'volvo-cars/price-engine', sourcePath: '.',
    sourceRevision: revision, observedAt, covers: ['src'], areaGaps: emptyGaps,
    evidence: [{ path: 'src/service.ts', lines: '1-3', claim: 'Defines the service.', revision }],
  }
  await operate('write_catalog', { repository: 'volvo-cars/price-engine', destination: 'source', component,
    expectedRevision: target.revision, expectedContext: target.context.token }, root)
  const plan = await readPlan(root)
  assert.equal(plan.snapshot.components.find(item => item.id === component.id)?.observedAt, observedAt)
  await assert.rejects(operate('write_catalog', { repository: 'volvo-cars/price-engine', destination: 'source', component,
    expectedRevision: target.revision, expectedContext: target.context.token }, root), /Catalog destination changed/)
})

test('write_catalog requires a source citation on every entry at the observation commit', async t => {
  const root = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const target = await readCatalogTarget(root, 'volvo-cars/price-engine', 'source')
  const component = {
    id: 'new-service', name: 'New service', repo: 'volvo-cars/price-engine', sourceRevision: 'a'.repeat(40),
    observedAt, covers: ['src'], areaGaps: emptyGaps,
    evidence: [{ path: 'src/service.ts', lines: '1', claim: 'Defines the service.', revision: 'a'.repeat(40) }],
    api: { name: 'Service API', endpoints: [{ id: 'read', name: 'Read', method: 'GET', path: '/read' }] },
  }
  await assert.rejects(operate('write_catalog', { repository: 'volvo-cars/price-engine', destination: 'source', component,
    expectedRevision: target.revision, expectedContext: target.context.token }, root), /endpoint read: add a source citation/)
})
