import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { access, chmod, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { applyRepositoryScan, discardRepositoryScan, prepareRepositoryScan } from '../server/scanner.ts'
import { acquire } from '../server/scan-acquire.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { context, git } from '../server/git.ts'
import { operate } from '../server/operations.ts'
import type { queryCatalog } from '../server/catalog.ts'
import { gitInit, guard, tempDir, withEnv } from './helpers.ts'

async function repository(t: TestContext) {
  const root = await gitInit(await tempDir(t, 'groundwork-scan-source-'))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await mkdir(path.join(root, 'dist'), { recursive: true })
  await mkdir(path.join(root, 'Api.Tests'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: '@example/catalog-api', dependencies: { kafkajs: '^2.0.0' } }))
  await writeFile(path.join(root, 'catalog-info.yaml'), 'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: catalog-api\n  title: Catalog API\nspec:\n  type: service\n')
  await writeFile(path.join(root, 'Api.Tests/Api.Tests.csproj'), '<Project />\n')
  await writeFile(path.join(root, '.gitignore'), 'ignored.txt\n')
  await writeFile(path.join(root, 'ignored.txt'), 'not tracked\n')
  await writeFile(path.join(root, 'src/routes.ts'), "router.get('/items/:id', getItem)\n")
  await writeFile(path.join(root, 'src/events.ts'), "producer.send('items.created', event)\n")
  await writeFile(path.join(root, 'src/model.ts'), 'export interface Item { id: string }\n')
  await writeFile(path.join(root, 'dist/generated.js'), '// @generated\n')
  await git(root, ['add', '.'])
  await git(root, ['add', '-f', 'dist/generated.js'])
  await git(root, ['commit', '-m', 'Fixture'])
  return root
}

async function target(t: TestContext) {
  const root = await tempDir(t, 'groundwork-scan-target-')
  await initialise(root, { name: 'Catalog' })
  return root
}

test('repository scans create bounded Git-free snapshots and apply one evidence-backed component write', async t => {
  const source = await repository(t)
  const root = await target(t)
  const prepared = await prepareRepositoryScan(root, { repository: source })
  assert.notEqual(path.dirname(prepared.sourcePath), root)
  await assert.rejects(access(path.join(prepared.sourcePath, '.git')))
  await assert.rejects(access(path.join(prepared.sourcePath, 'ignored.txt')))
  await assert.rejects(access(path.join(prepared.sourcePath, 'dist/generated.js')))
  assert.equal(await readFile(path.join(prepared.sourcePath, 'src/routes.ts'), 'utf8'), "router.get('/items/:id', getItem)\n")
  assert.deepEqual(prepared.packets.map((packet: any) => packet.area).sort(), ['api', 'data', 'dependencies', 'messaging'])
  assert.equal(prepared.projects.length, 1)
  assert.equal(prepared.projects[0].path, '.')
  assert.equal(prepared.projects[0].suggestedId, 'catalog-api')

  const plan = await readPlan(root)
  const result = await applyRepositoryScan(root, {
    scanId: prepared.scanId,
    expectedRevision: plan.revision,
    expectedContext: plan.context.token,
    discoveries: [{
      id: 'catalog-api',
      productId: 'app',
      sourcePath: '.',
      name: 'Catalog API',
      kind: 'service',
      ownership: 'internal',
      role: 'business-service',
      unresolvedDependencies: [{
        name: 'items.created',
        kind: 'topic',
        transport: 'Kafka',
        evidence: [{ path: 'src/events.ts', lines: '1', claim: 'Publishes the item-created event.', revision: prepared.revision }],
      }],
      api: {
        name: 'Catalog API',
        endpoints: [{
          id: 'get-item',
          name: 'Get item',
          method: 'GET',
          path: '/items/{id}',
          response: 'Item',
          evidence: [{ path: 'src/routes.ts', lines: '1', claim: 'Registers the item endpoint.', revision: prepared.revision }],
        }],
      },
      executionFlows: [{
        id: 'read-item', endpointId: 'get-item', name: 'Read item', summary: 'The source registers the read entry point; handler internals remain untraced.', sourceRevision: prepared.revision, entryStepId: 'request',
        steps: [{ id: 'request', title: 'Receive item request', kind: 'request', description: 'Dispatches GET /items/:id to getItem.', evidence: [{ path: 'src/routes.ts', lines: '1', claim: 'Registers the read endpoint.', revision: prepared.revision }] }],
        transitions: [], gaps: ['The fixture does not contain the handler implementation.'],
      }],
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'partial' },
      gaps: [{ area: 'messaging.delivery', reason: 'Retry policy is configured outside this repository.' }],
    }],
  })
  assert.deepEqual(result.applied, ['catalog-api'])
  assert.match(result.manifestId, /^[a-f0-9]{64}$/)
  assert.ok((await readPlan(root)).files[`scan-manifests/${result.manifestId}.json`])
  await assert.rejects(access(prepared.sourcePath))
  const component = (await readPlan(root)).snapshot.components[0]
  assert.equal(component.id, 'catalog-api')
  assert.equal(component.sourcePath, '.')
  assert.equal(component.sourceRevision, prepared.revision)
  assert.equal(component.api?.endpoints[0].evidence?.[0].path, 'src/routes.ts')
  assert.equal(component.executionFlows?.[0].endpointId, 'get-item')
  assert.equal(component.scan?.status, 'partial')
  assert.match(component.scan?.sourceFingerprint ?? '', /^[a-f0-9]{64}$/)
})

test('repository scan rejects fabricated evidence and can be discarded explicitly', async t => {
  const source = await repository(t)
  const root = await target(t)
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  const plan = await readPlan(root)
  await assert.rejects(applyRepositoryScan(root, {
    scanId: prepared.scanId,
    expectedRevision: plan.revision,
    expectedContext: plan.context.token,
    discoveries: [{
      id: 'catalog-api',
      productId: 'app',
      sourcePath: '.',
      name: 'Catalog API',
      api: { name: 'Catalog API', endpoints: [{ id: 'uncited', name: 'Uncited endpoint', method: 'GET', path: '/uncited' }] },
      coverage: { api: 'complete' },
    }],
  }), /requires evidence/)
  await assert.rejects(applyRepositoryScan(root, {
    scanId: prepared.scanId,
    expectedRevision: plan.revision,
    expectedContext: plan.context.token,
    discoveries: [{
      id: 'catalog-api',
      productId: 'app',
      sourcePath: '.',
      name: 'Catalog API',
      api: {
        name: 'Catalog API',
        endpoints: [{
          id: 'missing',
          name: 'Missing endpoint',
          method: 'GET',
          path: '/missing',
          evidence: [{ path: 'src/missing.ts', lines: '1', claim: 'This file does not exist.', revision: prepared.revision }],
        }],
      },
      coverage: { api: 'complete' },
    }],
  }), /not part of the scan snapshot/)
  await discardRepositoryScan({ scanId: prepared.scanId })
  await assert.rejects(access(prepared.sourcePath))
})

test('scan operations accept central checkout routing without leaking it into strict scanner inputs', async t => {
  const source = await repository(t)
  const root = await target(t)
  const checkoutId = (await context(root)).checkoutId
  const prepared = await operate('prepare_repository_scan', { checkoutId, repository: source, areas: ['api'] }, root) as
    Awaited<ReturnType<typeof prepareRepositoryScan>>
  assert.equal(prepared.target.context.checkoutId, checkoutId)
  await operate('discard_repository_scan', { scanId: prepared.scanId }, root)
})

test('large evidence lanes split into bounded packets instead of truncating coverage', async t => {
  const source = await repository(t)
  const root = await target(t)
  const prepared = await prepareRepositoryScan(root, {
    repository: source,
    areas: ['api'],
    budgets: { maxFiles: 1200, maxBytes: 20 * 1024 * 1024, maxFilesPerPacket: 1, maxPackets: 32 },
  })
  assert.ok(prepared.packets.length > 1)
  assert.ok(prepared.packets.every((packet: any) => packet.files.length <= 1))
  assert.equal(prepared.limitsReached, false)
  await discardRepositoryScan({ scanId: prepared.scanId })
})

test('malformed project manifests fail scan preparation instead of hiding project identity', async t => {
  const source = await repository(t)
  const root = await target(t)
  await rm(path.join(source, 'catalog-info.yaml'))
  await writeFile(path.join(source, 'package.json'), '{invalid')
  await git(source, ['add', '.'])
  await git(source, ['commit', '-m', 'Malformed manifest'])
  await assert.rejects(prepareRepositoryScan(root, { repository: source }), SyntaxError)
})

test('scan refresh cannot silently remove an active contract', async t => {
  const source = await repository(t)
  const root = await target(t)
  const initial = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  let plan = await readPlan(root)
  await applyRepositoryScan(root, {
    scanId: initial.scanId, ...guard(plan),
    discoveries: [{
      id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API',
      api: { name: 'Catalog API', endpoints: [{
        id: 'get-item', name: 'Get item', method: 'GET', path: '/items/{id}',
        evidence: [{ path: 'src/routes.ts', lines: '1', claim: 'Registers the route.', revision: initial.revision }],
      }] },
      coverage: { api: 'complete' },
    }],
  })
  const refresh = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  plan = await readPlan(root)
  await assert.rejects(applyRepositoryScan(root, {
    scanId: refresh.scanId, ...guard(plan),
    discoveries: [{ id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', coverage: { api: 'complete' } }],
  }), /omitted active endpoint records/)
  assert.equal((await readPlan(root)).snapshot.components[0].api?.endpoints.length, 1)
  await discardRepositoryScan({ scanId: refresh.scanId })
})

test('nested projects receive separate packets without leaking files across boundaries', async t => {
  const source = await repository(t)
  const root = await target(t)
  await rm(path.join(source, 'catalog-info.yaml'))
  await mkdir(path.join(source, 'services/api'), { recursive: true })
  await writeFile(path.join(source, 'services/api/package.json'), JSON.stringify({ name: '@example/child-api' }))
  await writeFile(path.join(source, 'services/api/routes.ts'), "router.get('/child', getChild)\n")
  await git(source, ['add', '.'])
  await git(source, ['commit', '-m', 'Add nested API'])
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  assert.deepEqual(prepared.projects.map(project => project.path), ['.', 'services/api'])
  const parent = prepared.packets.find(packet => packet.projectPath === '.')
  const child = prepared.packets.find(packet => packet.projectPath === 'services/api')
  assert.ok(parent?.files.includes('src/routes.ts'))
  assert.ok(!parent?.files.includes('services/api/routes.ts'))
  assert.ok(child?.files.includes('services/api/routes.ts'))
  assert.ok(!child?.files.includes('src/routes.ts'))
  await discardRepositoryScan({ scanId: prepared.scanId })
})

test('refresh preserves an existing repository-wide component without Backstage metadata', async t => {
  const source = await repository(t)
  const root = await target(t)
  await rm(path.join(source, 'catalog-info.yaml'))
  await rm(path.join(source, 'package.json'))
  for (const directory of ['Api', 'Core', 'Providers']) {
    await mkdir(path.join(source, directory))
    await writeFile(path.join(source, directory, `${directory}.csproj`), '<Project />\n')
  }
  await git(source, ['add', '.'])
  await git(source, ['commit', '-m', 'Split implementation into library projects'])
  await mkdir(path.join(root, '.groundwork/plans/components'), { recursive: true })
  await writeFile(path.join(root, '.groundwork/plans/components/catalog-api.json'), JSON.stringify({ id: 'catalog-api', productId: 'app', name: 'Catalog API', kind: 'service', repo: await realpath(source) }))
  const prepared = await prepareRepositoryScan(root, { repository: source })
  assert.deepEqual(prepared.projects.map((project: any) => [project.path, project.existingComponentId]), [['.', 'catalog-api']])
  assert.ok(prepared.packets.some((packet: any) => packet.files.includes('Api/Api.csproj')))
  const plan = await readPlan(root)
  await applyRepositoryScan(root, {
    scanId: prepared.scanId, ...guard(plan),
    discoveries: [{ id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API',
      evidence: [{ path: 'Core/Core.csproj', lines: '1', claim: 'Includes a core implementation library.', revision: prepared.revision }],
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' } }],
  })
  assert.equal((await readPlan(root)).snapshot.components.length, 1)
})

test('targeted investigation upserts preserve siblings and broad coverage, and repeat discovery retrieves the saved answer', async t => {
  const source = await repository(t)
  const root = await target(t)
  let prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  let plan = await readPlan(root)
  const citation = { path: 'src/routes.ts', lines: '1', claim: 'Registers the GET route.', revision: prepared.revision }
  await applyRepositoryScan(root, { scanId: prepared.scanId, ...guard(plan), discoveries: [{ id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', api: { name: 'API', endpoints: [{ id: 'get-item', name: 'Get item', method: 'GET', path: '/items/{id}', evidence: [citation] }, { id: 'sibling', name: 'Sibling contract', method: 'GET', path: '/sibling', evidence: [citation] }] }, coverage: { api: 'partial' }, gaps: [{ area: 'api', reason: 'Only the route registration is available.' }] }] })
  prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  plan = await readPlan(root)
  const before = structuredClone(plan.snapshot.components[0])
  const args = { scanId: prepared.scanId, componentId: 'catalog-api', ...guard(plan), findings: [{ id: 'route-dispatch', name: 'Item route dispatch', question: 'Where does the item request enter?', answer: 'The router sends GET /items/:id to getItem.', subjects: [{ kind: 'endpoint', id: 'get-item' }], boundary: 'Route registration only; handler implementation is absent.', assumptions: ['Handler behavior needs further inspection.'], repository: prepared.repository, sourceRevision: prepared.revision, evidence: [citation] }] }
  await assert.rejects(operate('apply_catalog_investigation', { ...args, expectedRevision: 'stale' }, root), /Stale/)
  await assert.rejects(operate('apply_catalog_investigation', { ...args, findings: [{ ...args.findings[0], repository: 'wrong/repo' }] }, root), /repository/)
  await assert.rejects(operate('apply_catalog_investigation', { ...args, findings: [{ ...args.findings[0], evidence: [{ ...citation, lines: '999' }] }] }, root), /outside/)
  await operate('apply_catalog_investigation', args, root)
  plan = await readPlan(root)
  assert.deepEqual(plan.snapshot.components[0].api, before.api)
  assert.deepEqual(plan.snapshot.components[0].scan, before.scan)
  assert.deepEqual(plan.snapshot.components[0].gaps, before.gaps)
  const result = await operate('get_discovery_context', { question: 'item route dispatch' }, root) as
    Omit<Awaited<ReturnType<typeof queryCatalog>>, 'items'> & { items: { kind: string; name: string; freshness: { status: string } }[] }
  assert.ok(result.items.some(item => item.kind === 'finding' && item.name === 'Item route dispatch'))
  assert.ok(result.items.every(item => item.freshness.status === 'unchecked'))
})

async function write(root: string, changes: Record<string, string>) {
  const plan = await readPlan(root)
  await writePlan(root, { ...guard(plan), changes })
}

async function apply(root: string, scanId: string, discoveries: unknown[]) {
  const plan = await readPlan(root)
  return applyRepositoryScan(root, { scanId, ...guard(plan), discoveries })
}

/** A scan directory of this test's own, so sweeps cannot see scans from other tests in this file. */
async function isolatedScans(t: TestContext) {
  const base = await tempDir(t, 'groundwork-scan-base-')
  withEnv(t, { GROUNDWORK_TMPDIR: base })
  return base
}

test('a sourceRef that looks like a git option is rejected before any process runs', async t => {
  const source = await repository(t)
  const root = await target(t)
  const base = await isolatedScans(t)
  const marker = path.join(source, 'PWNED')
  for (const sourceRef of [`--upload-pack=touch ${marker}; git-upload-pack`, '-c', 'main..other', 'HEAD~1', 'a b']) {
    await assert.rejects(prepareRepositoryScan(root, { repository: source, sourceRef }), /sourceRef|branch, tag or commit/, sourceRef)
  }
  await assert.rejects(access(marker))
  assert.deepEqual(await readdir(base), [], 'no scan workspace was created')
  // The acquisition layer validates the ref again and never starts git for it.
  const clone = path.join(base, 'clone')
  await assert.rejects(acquire(source, `--upload-pack=touch ${marker}`, clone))
  await assert.rejects(access(clone))
  await assert.rejects(access(marker))
  // A full commit hash is accepted.
  const revision = await git(source, ['rev-parse', 'HEAD'])
  const pinned = await prepareRepositoryScan(root, { repository: source, sourceRef: revision, areas: ['api'] })
  assert.equal(pinned.revision, revision)
  await discardRepositoryScan({ scanId: pinned.scanId })
})

test('owner/name shorthand must start with a letter or digit so gh never sees a flag', async t => {
  const base = await isolatedScans(t)
  await assert.rejects(acquire('-R/evil', undefined, path.join(base, 'clone')), /existing local path, owner\/name, or Git URL/)
  await assert.rejects(access(path.join(base, 'clone')))
})

test('repository credentials are rejected as input and stripped from local origins', async t => {
  const source = await repository(t)
  const root = await target(t)
  await assert.rejects(prepareRepositoryScan(root, { repository: 'https://x-access-token:ghs_SECRET@github.com/acme/api.git' }), /credentials/)
  await git(source, ['remote', 'add', 'origin', 'https://x-access-token:ghs_SECRET@github.com/Acme/Api.git'])
  await write(root, { 'components/api.json': JSON.stringify({ id: 'api', productId: 'app', name: 'API', repo: 'github.com/Acme/Api' }) })
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  assert.equal(prepared.repository, 'acme/api')
  assert.ok(!(await readFile(path.join(path.dirname(prepared.sourcePath), 'scan.json'), 'utf8')).includes('ghs_SECRET'))
  // The existing component written as github.com/Acme/Api is recognised as the same repository.
  assert.equal(prepared.projects[0].existingComponentId, 'api')
  const result = await apply(root, prepared.scanId, [{ id: 'api', productId: 'app', sourcePath: '.', name: 'API', coverage: { api: 'partial' } }])
  assert.equal(result.repository, 'acme/api')
  const plan = await readPlan(root)
  assert.ok(!Object.values(plan.files).some(raw => raw.includes('ghs_SECRET')))
})

test('snapshots hold committed bytes, so evidence digests match with eol conversion', async t => {
  const source = await repository(t)
  const root = await target(t)
  await writeFile(path.join(source, '.gitattributes'), '*.ts text eol=crlf\n')
  await git(source, ['add', '.gitattributes'])
  await git(source, ['commit', '-m', 'Check out TypeScript with CRLF'])
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  assert.equal(await readFile(path.join(prepared.sourcePath, 'src/routes.ts'), 'utf8'), "router.get('/items/:id', getItem)\n")
  await apply(root, prepared.scanId, [{
    id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API',
    api: { name: 'Catalog API', endpoints: [{ id: 'get-item', name: 'Get item', method: 'GET', path: '/items/{id}',
      evidence: [{ path: 'src/routes.ts', lines: '1', claim: 'Registers the route.', revision: prepared.revision }] }] },
    coverage: { api: 'complete' },
  }])
  assert.equal((await readPlan(root)).snapshot.components[0].api?.endpoints[0].id, 'get-item')
})

test('evidence ranges stop at the last line and source pointers must name snapshot files at the pinned revision', async t => {
  const source = await repository(t)
  const root = await target(t)
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  const endpoint = (patch: object) => ({
    id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', coverage: { api: 'complete' },
    api: { name: 'Catalog API', endpoints: [{ id: 'get-item', name: 'Get item', method: 'GET', path: '/items/{id}',
      evidence: [{ path: 'src/routes.ts', lines: '1', claim: 'Registers the route.', revision: prepared.revision }], ...patch }] },
  })
  await assert.rejects(apply(root, prepared.scanId, [endpoint({
    evidence: [{ path: 'src/routes.ts', lines: '2', claim: 'Past the end of a one-line file.', revision: prepared.revision }],
  })]), /outside the scanned file/)
  await assert.rejects(apply(root, prepared.scanId, [endpoint({ source: 'src/missing.ts' })]), /source is not a file in the scan snapshot/)
  const base = endpoint({ source: 'src/routes.ts' })
  const discovery = { ...base, api: { ...base.api, sourceRevision: 'b'.repeat(40) } }
  await assert.rejects(apply(root, prepared.scanId, [discovery]), /does not match the pinned scan revision/)
  await apply(root, prepared.scanId, [endpoint({ source: 'src/routes.ts' })])
})

test('a partial-area rescan keeps other areas\' evidence and gaps and never reports stale areas complete', async t => {
  const source = await repository(t)
  const root = await target(t)
  await write(root, { 'components/other.json': JSON.stringify({ id: 'other', productId: 'app', name: 'Other' }) })
  const full = await prepareRepositoryScan(root, { repository: source })
  const dependencyEvidence = [{ path: 'package.json', lines: '1', claim: 'Declares dependencies.', revision: full.revision }]
  await apply(root, full.scanId, [{
    id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', dependsOn: ['other'], evidence: dependencyEvidence,
    coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' },
    gaps: [{ area: 'messaging.delivery', reason: 'Retries are configured elsewhere.' }, { area: 'api', reason: 'Old API gap.' }],
  }])
  let component = (await readPlan(root)).snapshot.components.find(item => item.id === 'catalog-api')!
  assert.equal(component.scan?.status, 'complete')
  await writeFile(path.join(source, 'src/routes.ts'), "router.get('/items/:id', getItem)\nrouter.get('/items', listItems)\n")
  await git(source, ['commit', '-am', 'Add list route'])
  const partial = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  assert.notEqual(partial.revision, full.revision)
  await apply(root, partial.scanId, [{
    id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', coverage: { api: 'complete' },
    api: { name: 'Catalog API', endpoints: [{ id: 'list-items', name: 'List items', method: 'GET', path: '/items',
      evidence: [{ path: 'src/routes.ts', lines: '2', claim: 'Registers the list route.', revision: partial.revision }] }] },
  }])
  component = (await readPlan(root)).snapshot.components.find(item => item.id === 'catalog-api')!
  assert.deepEqual(component.dependsOn, ['other'])
  assert.deepEqual(component.evidence, dependencyEvidence)
  assert.deepEqual(component.gaps, [{ area: 'messaging.delivery', reason: 'Retries are configured elsewhere.' }])
  assert.equal(component.scan?.revision, partial.revision)
  assert.equal(component.scan?.status, 'partial')
  assert.deepEqual(component.scan?.coverage, { dependencies: 'partial', api: 'complete', data: 'partial', messaging: 'partial' })
})

test('packet budget exhaustion is reported and forbids complete coverage', async t => {
  const source = await repository(t)
  const root = await target(t)
  const prepared = await prepareRepositoryScan(root, {
    repository: source, budgets: { maxFiles: 1200, maxBytes: 20 * 1024 * 1024, maxFilesPerPacket: 80, maxPackets: 1 },
  })
  assert.equal(prepared.packets.length, 1)
  assert.equal(prepared.limitsReached, true)
  assert.equal(prepared.excluded['packet-budget'], 3)
  await assert.rejects(apply(root, prepared.scanId, [{
    id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API',
    coverage: { dependencies: 'complete', api: 'partial', data: 'partial', messaging: 'partial' },
  }]), /budget-limited scan areas must report partial coverage/)
  await discardRepositoryScan({ scanId: prepared.scanId })
})

test('scans are bound to their checkout and expire', async t => {
  const source = await repository(t)
  const root = await target(t)
  const other = await target(t)
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  const discovery = { id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', coverage: { api: 'partial' } }
  await assert.rejects(apply(other, prepared.scanId, [discovery]), /another Groundwork project or checkout/)
  const metadataFile = path.join(path.dirname(prepared.sourcePath), 'scan.json')
  const metadata = JSON.parse(await readFile(metadataFile, 'utf8'))
  await writeFile(metadataFile, JSON.stringify({ ...metadata, expiresAt: new Date(Date.now() - 1000).toISOString() }))
  await assert.rejects(apply(root, prepared.scanId, [discovery]), /expired/)
  await writeFile(metadataFile, JSON.stringify({ ...metadata, files: 'tampered' }))
  await assert.rejects(apply(root, prepared.scanId, [discovery]), /Invalid scan metadata/)
  await discardRepositoryScan({ scanId: prepared.scanId })
})

test('scan cleanup never follows symlinks and one broken scan does not block the sweep', async t => {
  const source = await repository(t)
  const root = await target(t)
  await isolatedScans(t)
  const outside = await tempDir(t, 'groundwork-outside-')
  await chmod(outside, 0o755)
  const first = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  await symlink(outside, path.join(first.outputPath, 'evil'))
  await discardRepositoryScan({ scanId: first.scanId })
  assert.equal((await stat(outside)).mode & 0o777, 0o755)
  await assert.rejects(access(first.sourcePath))

  const expired = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  const directory = path.dirname(expired.sourcePath)
  await symlink(path.join(outside, 'missing'), path.join(expired.outputPath, 'dangling'))
  const metadata = JSON.parse(await readFile(path.join(directory, 'scan.json'), 'utf8'))
  await writeFile(path.join(directory, 'scan.json'), JSON.stringify({ ...metadata, expiresAt: new Date(Date.now() - 1000).toISOString() }))
  const next = await prepareRepositoryScan(root, { repository: source, areas: ['api'] })
  await assert.rejects(access(directory))
  await discardRepositoryScan({ scanId: next.scanId })
})
