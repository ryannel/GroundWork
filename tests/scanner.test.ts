import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { applyRepositoryScan, discardRepositoryScan, prepareRepositoryScan } from '../server/scanner.ts'
import { readPlan } from '../server/repository.ts'
import { context, git } from '../server/git.ts'
import { operate } from '../server/operations.ts'

async function repository(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-scan-source-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await git(root, ['init', '-b', 'main'])
  await git(root, ['config', 'user.email', 'tests@example.invalid'])
  await git(root, ['config', 'user.name', 'Groundwork tests'])
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

async function target(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-scan-target-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { name: 'Catalog' })
  return root
}

test('repository scans create bounded Git-free snapshots and apply one evidence-backed component write', async t => {
  const source = await repository(t)
  const root = await target(t)
  const prepared = await prepareRepositoryScan(root, { repository: source }) as any
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
  }) as any
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
  const prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] }) as any
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
  const prepared = await operate('prepare_repository_scan', { checkoutId, repository: source, areas: ['api'] }, root) as any
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
  }) as any
  assert.ok(prepared.packets.length > 1)
  assert.ok(prepared.packets.every((packet: any) => packet.files.length <= 1 && !packet.truncated))
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
    scanId: initial.scanId, expectedRevision: plan.revision, expectedContext: plan.context.token,
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
    scanId: refresh.scanId, expectedRevision: plan.revision, expectedContext: plan.context.token,
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
  const prepared = await prepareRepositoryScan(root, { repository: source }) as any
  assert.deepEqual(prepared.projects.map((project: any) => [project.path, project.existingComponentId]), [['.', 'catalog-api']])
  assert.ok(prepared.packets.some((packet: any) => packet.files.includes('Api/Api.csproj')))
  const plan = await readPlan(root)
  await applyRepositoryScan(root, {
    scanId: prepared.scanId, expectedRevision: plan.revision, expectedContext: plan.context.token,
    discoveries: [{ id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API',
      evidence: [{ path: 'Core/Core.csproj', lines: '1', claim: 'Includes a core implementation library.', revision: prepared.revision }],
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' } }],
  })
  assert.equal((await readPlan(root)).snapshot.components.length, 1)
})

test('targeted investigation upserts preserve siblings and broad coverage, and repeat discovery retrieves the saved answer', async t => {
  const source = await repository(t)
  const root = await target(t)
  let prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] }) as any
  let plan = await readPlan(root)
  const citation = { path: 'src/routes.ts', lines: '1', claim: 'Registers the GET route.', revision: prepared.revision }
  await applyRepositoryScan(root, { scanId: prepared.scanId, expectedRevision: plan.revision, expectedContext: plan.context.token, discoveries: [{ id: 'catalog-api', productId: 'app', sourcePath: '.', name: 'Catalog API', api: { name: 'API', endpoints: [{ id: 'get-item', name: 'Get item', method: 'GET', path: '/items/{id}', evidence: [citation] }, { id: 'sibling', name: 'Sibling contract', method: 'GET', path: '/sibling', evidence: [citation] }] }, coverage: { api: 'partial' }, gaps: [{ area: 'api', reason: 'Only the route registration is available.' }] }] })
  prepared = await prepareRepositoryScan(root, { repository: source, areas: ['api'] }) as any
  plan = await readPlan(root)
  const before = structuredClone(plan.snapshot.components[0])
  const args = { scanId: prepared.scanId, componentId: 'catalog-api', expectedRevision: plan.revision, expectedContext: plan.context.token, findings: [{ id: 'route-dispatch', name: 'Item route dispatch', question: 'Where does the item request enter?', answer: 'The router sends GET /items/:id to getItem.', subjects: [{ kind: 'endpoint', id: 'get-item' }], boundary: 'Route registration only; handler implementation is absent.', assumptions: ['Handler behavior needs further inspection.'], repository: prepared.repository, sourceRevision: prepared.revision, evidence: [citation] }] }
  await assert.rejects(operate('apply_catalog_investigation', { ...args, expectedRevision: 'stale' }, root), /Stale/)
  await assert.rejects(operate('apply_catalog_investigation', { ...args, findings: [{ ...args.findings[0], repository: 'wrong/repo' }] }, root), /repository/)
  await assert.rejects(operate('apply_catalog_investigation', { ...args, findings: [{ ...args.findings[0], evidence: [{ ...citation, lines: '999' }] }] }, root), /outside/)
  await operate('apply_catalog_investigation', args, root)
  plan = await readPlan(root)
  assert.deepEqual(plan.snapshot.components[0].api, before.api)
  assert.deepEqual(plan.snapshot.components[0].scan, before.scan)
  assert.deepEqual(plan.snapshot.components[0].gaps, before.gaps)
  const result = await operate('get_discovery_context', { question: 'item route dispatch' }, root) as any
  assert.ok(result.items.some((item: any) => item.kind === 'finding' && item.name === 'Item route dispatch'))
  assert.ok(result.items.every((item: any) => item.freshness.status === 'unchecked'))
})
