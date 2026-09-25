import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { proposeLocalCatalog } from '../server/catalog-proposal.ts'
import { digest, git } from '../server/git.ts'
import { scanManifestSchema } from '../src/data/scan-manifest.ts'
import { readCatalogTarget } from '../server/repository.ts'
import { commitAll, gitInit, homeFixture, tempDir, writeFiles } from './helpers.ts'

async function fixture(t: Parameters<typeof homeFixture>[0]) {
  const homeRoot = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const sourceRoot = await gitInit(path.join(await tempDir(t, 'groundwork-proposal-'), 'gpe-pretax'))
  await git(sourceRoot, ['remote', 'add', 'origin', 'git@github.com:volvo-cars/gpe-pretax.git'])
  await writeFiles(sourceRoot, { 'package.json': '{"name":"gpe-pretax"}\n' })
  const head = await commitAll(sourceRoot, 'Source code')
  const request = { homeRoot, sourceRoot, repository: 'volvo-cars/gpe-pretax', productId: 'price-engine' }
  return { ...request, head }
}

test('local-only area produces a reviewable dry run and an explicit uncommitted source write', async t => {
  const request = await fixture(t)
  const beforeStatus = await git(request.sourceRoot, ['status', '--short'])
  const preview = await proposeLocalCatalog(request)
  assert.equal(preview.applied, false)
  assert.equal(preview.canApply, true)
  assert.equal(preview.documents[0].path, 'components/pretax-api--src-api.json')
  assert.ok(preview.documents.some(item => item.path.startsWith('scan-manifests/')))
  assert.equal(preview.documents[0].before, null)
  assert.equal(JSON.parse(preview.documents[0].after).api.endpoints[0].id, 'prices')
  assert.ok(preview.units.some(unit => unit.kind === 'area' && unit.id === 'api' && unit.provenance.reason === 'local-only'))
  assert.equal(await git(request.sourceRoot, ['status', '--short']), beforeStatus, 'preview must not write')
  await assert.rejects(proposeLocalCatalog({ ...request, apply: true }), /requires its preview proposalId/)
  const applied = await proposeLocalCatalog({ ...request, apply: true, expectedProposalId: preview.proposalId })
  assert.equal(applied.applied, true)
  assert.equal(await git(request.sourceRoot, ['rev-parse', 'HEAD']), request.head, 'apply must not commit')
  assert.match(await git(request.sourceRoot, ['status', '--short']), /\.groundwork\//)
  const target = await readCatalogTarget(request.sourceRoot, request.repository, 'source')
  assert.equal(target.plan.snapshot.components[0].api?.endpoints[0].id, 'prices')
  const again = await proposeLocalCatalog(request)
  assert.equal(again.canApply, false, 'the source catalog now contains the local area')
  assert.deepEqual(again.documents, [])
})

test('a changed local catalog invalidates a reviewed preview without touching the source', async t => {
  const request = await fixture(t)
  const preview = await proposeLocalCatalog(request)
  const localApi = path.join(request.homeRoot,
    '.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/components/pretax-api--src-api/api.json')
  const api = JSON.parse(await readFile(localApi, 'utf8')) as { endpoints: { id: string; path: string }[] }
  api.endpoints[0].path = '/updated-prices'
  await writeFile(localApi, JSON.stringify(api))
  await assert.rejects(proposeLocalCatalog({ ...request, apply: true, expectedProposalId: preview.proposalId }),
    /Catalog proposal changed/)
  assert.equal((await readCatalogTarget(request.sourceRoot, request.repository, 'source')).plan.snapshot.components.length, 0)
})

test('proposal refuses unrelated product repositories and a checkout with the wrong identity', async t => {
  const request = await fixture(t)
  await assert.rejects(proposeLocalCatalog({ ...request, productId: 'product-configuration-facade' }),
    /does not declare repository/)
  await assert.rejects(proposeLocalCatalog({ ...request, sourceRoot: request.homeRoot }),
    /Checkout is not repository/)
})

test('a descendant local area replaces the source area and carries its observation metadata', async t => {
  const request = await fixture(t)
  const sourceComponent = {
    schemaVersion: 3, id: 'pretax-api--src-api', name: 'Pretax API', kind: 'service',
    repo: request.repository, sourcePath: 'src/api', sourceRevision: request.head,
    scan: { status: 'partial', areaRevisions: { api: { revision: request.head } } },
  }
  await writeFiles(request.sourceRoot, {
    '.groundwork/catalog/components/pretax-api--src-api/component.json': JSON.stringify(sourceComponent),
    '.groundwork/catalog/components/pretax-api--src-api/api.json': JSON.stringify({
      name: 'Pretax API', endpoints: [{ id: 'prices', name: 'Prices', method: 'GET', path: '/old-prices' }],
    }),
  })
  await commitAll(request.sourceRoot, 'Older source catalog')
  await writeFiles(request.sourceRoot, { 'package.json': '{"name":"gpe-pretax","version":"2"}\n' })
  const descendant = await commitAll(request.sourceRoot, 'Newer source code')
  const localComponentPath = path.join(request.homeRoot,
    '.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/components/pretax-api--src-api/component.json')
  const localComponent = JSON.parse(await readFile(localComponentPath, 'utf8')) as typeof sourceComponent
  localComponent.scan = { status: 'partial', areaRevisions: { api: { revision: descendant } } }
  await writeFile(localComponentPath, JSON.stringify(localComponent))
  const preview = await proposeLocalCatalog(request)
  assert.equal(preview.canApply, true)
  assert.ok(preview.units.some(unit => unit.kind === 'area' && unit.id === 'api'
    && unit.provenance.reason === 'local-newer'))
  const after = JSON.parse(preview.documents[0].after) as typeof sourceComponent & { api: { endpoints: { path: string }[] } }
  assert.equal(after.api.endpoints[0].path, '/prices')
  assert.equal(after.scan.areaRevisions.api.revision, descendant)
  await proposeLocalCatalog({ ...request, apply: true, expectedProposalId: preview.proposalId })
  const repeat = await proposeLocalCatalog(request)
  assert.equal(repeat.canApply, false)
  assert.deepEqual(repeat.documents, [])
})

test('a product cannot overwrite a source component with the same ID outside its declared paths', async t => {
  const request = await fixture(t)
  await writeFiles(request.sourceRoot, {
    '.groundwork/catalog/components/pretax-api--src-api/component.json': JSON.stringify({
      schemaVersion: 3, id: 'pretax-api--src-api', name: 'Another product component',
      repo: request.repository, sourcePath: 'unrelated',
    }),
  })
  const preview = await proposeLocalCatalog(request)
  assert.equal(preview.canApply, false)
  assert.match(preview.issues.join('; '), /already belongs to another product/)
  await assert.rejects(proposeLocalCatalog({ ...request, apply: true, expectedProposalId: preview.proposalId }),
    /already belongs to another product/)
  const target = await readCatalogTarget(request.sourceRoot, request.repository, 'source')
  assert.equal(target.plan.snapshot.components[0].name, 'Another product component')
})

test('a proposal cannot create a second source component for the same project boundary', async t => {
  const request = await fixture(t)
  await writeFiles(request.sourceRoot, {
    '.groundwork/catalog/components/source-existing/component.json': JSON.stringify({
      schemaVersion: 3, id: 'source-existing', name: 'Existing API',
      repo: request.repository, sourcePath: 'src/api',
    }),
  })
  const preview = await proposeLocalCatalog(request)
  assert.equal(preview.canApply, false)
  assert.deepEqual(preview.documents, [])
  assert.match(preview.issues.join('; '), /shares repository path src\/api with source component source-existing/)
})

test('a proposal carries the immutable local scan manifest into the source catalog', async t => {
  const request = await fixture(t)
  const timestamp = '2026-01-01T00:00:00Z'
  const manifest = scanManifestSchema.parse({
    version: 1, scannerVersion: 3, scanId: '00000000-0000-4000-8000-000000000001',
    repository: request.repository, sourceRevision: request.head, requestedRef: null,
    preparedAt: timestamp, appliedAt: timestamp, catalogRevisionBefore: 'before', mode: 'baseline',
    scope: [{ componentId: 'pretax-api--src-api', sourcePath: 'src/api', areas: ['api'], observationIds: [] }],
    exclusions: {}, budgets: {}, files: [], dependencyFingerprints: [], omittedDependencyFingerprints: 0,
    mappings: [], note: 'Pinned local scan evidence',
  })
  const raw = `${JSON.stringify(manifest)}\n`
  const id = digest(raw)
  await writeFiles(request.homeRoot, {
    [`.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/scans/${id}.json`]: raw,
  })
  const preview = await proposeLocalCatalog(request)
  assert.equal(preview.canApply, true)
  assert.ok(preview.documents.some(item => item.path === `scan-manifests/${id}.json` && item.after === raw))
  await proposeLocalCatalog({ ...request, apply: true, expectedProposalId: preview.proposalId })
  const copied = await readFile(path.join(request.sourceRoot, `.groundwork/catalog/scans/${id}.json`), 'utf8')
  assert.equal(copied, raw)
})
