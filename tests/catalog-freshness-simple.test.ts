import { test } from 'node:test'
import assert from 'node:assert/strict'
import { operate } from '../server/operations.ts'
import { readCatalogTarget } from '../server/repository.ts'
import { commitAll, homeFixture, writeFiles } from './helpers.ts'

const observedAt = '2026-09-25T12:00:00Z'
const gaps = { dependencies: [], api: [], data: [], messaging: [], jobs: [], flows: [] }

test('freshness identifies changed citations, uncovered entries and uncatalogued source files', async t => {
  const root = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  await writeFiles(root, { 'src/handler.ts': 'export const handler = 1\n', 'src/helper.ts': 'export const helper = 1\n',
    'scripts/build.ts': 'export const build = 1\n' })
  const revision = await commitAll(root, 'Observed code')
  const target = await readCatalogTarget(root, 'volvo-cars/price-engine', 'source')
  await operate('write_catalog', { repository: 'volvo-cars/price-engine', destination: 'source',
    expectedRevision: target.revision, expectedContext: target.context.token,
    component: { id: 'handler', name: 'Handler', repo: 'volvo-cars/price-engine', sourceRevision: revision,
      observedAt, covers: ['src'], areaGaps: gaps,
      evidence: [{ path: 'src/handler.ts', lines: '1', claim: 'Defines handler.', revision }] } }, root)
  await writeFiles(root, { 'src/handler.ts': 'export const handler = 2\n', 'src/helper.ts': 'export const helper = 2\n',
    'scripts/build.ts': 'export const build = 2\n' })
  await commitAll(root, 'Changed code')
  const report = await operate('check_catalog_freshness', { repository: 'volvo-cars/price-engine',
    sourceRoot: root, targetRef: 'HEAD' }, root) as { assessments: { changedCitations: string[]; changedCoveredFiles: string[] }[];
      uncataloguedFiles: string[]; status: string }
  assert.deepEqual(report.assessments[0].changedCitations, ['src/handler.ts'])
  assert.deepEqual(report.assessments[0].changedCoveredFiles, ['src/helper.ts'])
  assert.deepEqual(report.uncataloguedFiles, ['scripts/build.ts'])
  assert.equal(report.status, 'unknown', 'older fixture components without coverage keep the aggregate uncertain')
})
