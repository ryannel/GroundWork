import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import {
  catalogMetadata, derivedComponentId, detectProjects, filesForProject, isTestSegment, packetFiles, type DetectedProject, type InventoryFile,
} from '../server/scan-projects.ts'
import { idPattern } from '../src/data/schema-primitives.ts'
import type { Component } from '../src/data/model.ts'
import { tempDir, writeFiles } from './helpers.ts'

const file = (value: string): InventoryFile => ({ path: value, digest: 'a'.repeat(40), bytes: 1 })
const project = (value: string, manifest = `${value === '.' ? '' : `${value}/`}package.json`): DetectedProject =>
  ({ path: value, name: value, suggestedId: value, derivedId: value, manifest })

async function snapshot(t: TestContext, contents: Record<string, string>) {
  const root = await tempDir(t, 'groundwork-projects-')
  await writeFiles(root, contents)
  return { root, files: Object.keys(contents).map(file) }
}

test('filesForProject keeps each file in its nearest project boundary', () => {
  const files = ['README.md', 'src/app.ts', 'services/api/package.json', 'services/api/routes.ts', 'services/api-docs/index.md'].map(file)
  const projects = [project('.'), project('services/api')]
  assert.deepEqual(filesForProject(files, projects[0], projects).map(item => item.path), ['README.md', 'src/app.ts', 'services/api-docs/index.md'])
  assert.deepEqual(filesForProject(files, projects[1], projects).map(item => item.path), ['services/api/package.json', 'services/api/routes.ts'])
})

test('packetFiles selects identity files and lane matches outside test directories', () => {
  const files = [
    'package.json', 'README.md', 'src/routes.ts', 'src/latest/routes.ts', 'test/routes.ts', 'Api.Tests/RoutesTests.cs',
    'src/IntegrationTests/routes.ts', 'fixtures/routes.json', 'src/model.ts',
  ].map(file)
  assert.deepEqual(packetFiles(files, 'api', project('.')), ['package.json', 'README.md', 'src/routes.ts', 'src/latest/routes.ts'])
})

test('test segments match test and fixture directories but not words ending in "test"', () => {
  for (const segment of ['test', 'tests', 'Api.Tests', 'unit-tests', 'api_test', 'IntegrationTests', '__tests__', 'fixtures']) assert.ok(isTestSegment(segment), segment)
  for (const segment of ['latest', 'contest', 'attestation', 'src']) assert.ok(!isTestSegment(segment), segment)
})

test('catalog-info metadata reads top-level title and name, quoted or not', () => {
  const source = [
    'apiVersion: backstage.io/v1alpha1', 'kind: Component', 'metadata:', '  annotations:', '    title: Nested title',
    "  name: 'orders-api'", '  title: "Orders API"', 'spec:', '  type: service', '',
  ].join('\r\n')
  assert.deepEqual(catalogMetadata(source), { title: 'Orders API', name: 'orders-api' })
  assert.deepEqual(catalogMetadata('kind: Component\nmetadata:\n    name: deep\n'), { title: undefined, name: 'deep' })
  assert.equal(catalogMetadata('kind: System\nmetadata:\n  name: x\n'), null)
})

test('detectProjects uses Backstage metadata for a repository-wide component', async t => {
  const { root, files } = await snapshot(t, {
    'catalog-info.yaml': 'kind: Component\nmetadata:\n  name: orders-api\n  title: Orders API\n',
    'package.json': '{"name":"@acme/orders"}',
  })
  assert.deepEqual(await detectProjects(root, files, 'acme/orders', []),
    [{ path: '.', name: 'Orders API', derivedId: 'orders-api', suggestedId: 'orders-api', manifest: 'catalog-info.yaml' }])
  const existing = [{ id: 'orders', productId: 'app', name: 'Orders', repo: 'acme/orders' }] as Component[]
  assert.equal((await detectProjects(root, files, 'acme/orders', existing))[0].existingComponentId, 'orders')
})

test('detectProjects finds manifests outside test directories and derives IDs from name and folder', async t => {
  const { root, files } = await snapshot(t, {
    'services/a/package.json': '{"name":"api"}',
    'services/b/package.json': '{"name":"api"}',
    'tests/fixture/package.json': '{"name":"fixture"}',
    'Api.Tests/Api.Tests.csproj': '<Project />',
    'latest/go.mod': 'module latest',
  })
  const projects = await detectProjects(root, files, 'acme/mono', [])
  assert.deepEqual(projects.map(item => item.path), ['latest', 'services/a', 'services/b'])
  const [a, b] = projects.slice(1)
  // The folder is part of the derived ID whether or not another project shares the name, so adding a same-named
  // project later never changes an ID that was already derived.
  assert.equal(a.suggestedId, 'api--services-a')
  assert.equal(b.suggestedId, 'api--services-b')
  assert.equal(projects[0].suggestedId, 'latest--latest')
  assert.deepEqual(projects.map(item => item.derivedId), projects.map(item => item.suggestedId))
})

test('a registered repository-wide component absorbs library projects and falls back to a solution file', async t => {
  const { root, files } = await snapshot(t, { 'App.sln': '', 'Core/Core.csproj': '<Project />', 'Web/Web.csproj': '<Project />' })
  const existing = [{ id: 'app', productId: 'app', name: 'App', repo: '/work/app' }] as Component[]
  assert.deepEqual(await detectProjects(root, files, '/work/app', existing), [
    // The derived ID keeps the manifest's own spelling; only the suggestion is lower-cased for readability.
    { path: '.', name: 'App', derivedId: 'App', suggestedId: 'app', existingComponentId: 'app', manifest: 'App.sln' },
  ])
})

test('derived component IDs separate names and folders a slug would fold together', () => {
  const distinct = [
    ['api', 'services/price'], ['api', 'services-price'], ['api', 'services_price'], ['api', 'Services/Price'],
    ['price.v2', '.'], ['price-v2', '.'], ['price_v2', '.'], ['Price-v2', '.'], ['prïce', '.'], ['price', '.'],
    ['price-api', 'src/api'], ['price--api', 'src/api'],
  ] as const
  const ids = distinct.map(([name, source]) => derivedComponentId(name, source))
  assert.equal(new Set(ids).size, ids.length, `every name and folder keeps its own ID: ${ids.join(', ')}`)
  for (const id of ids) assert.match(id, idPattern, `${id} is usable as a component ID`)
  // The common case still reads as itself, and an npm scope names the publisher rather than the project.
  assert.equal(derivedComponentId('api', 'services/price'), 'api--services-price')
  assert.equal(derivedComponentId('api', 'services-price'), 'api--services_hprice')
  assert.equal(derivedComponentId('@acme/price-api', 'src/api'), 'price-api--src-api')
  assert.equal(derivedComponentId('price.v2', '.'), 'price_dv2')
  // The ID depends only on the component's own name and path, so it never changes because a sibling appeared.
  assert.equal(derivedComponentId('api', '.'), 'api')
  const long = derivedComponentId('a'.repeat(200), 'b'.repeat(200))
  assert.ok(long.length <= 120 && idPattern.test(long), 'an over-long name is truncated to a usable ID')
  assert.equal(long, derivedComponentId('a'.repeat(200), 'b'.repeat(200)), 'and is still deterministic')
  assert.notEqual(long, derivedComponentId('a'.repeat(200), `${'b'.repeat(199)}c`))
})

test('a clean scan and an incremental scan of the same commit derive the same IDs', async t => {
  const tree = { 'services/price/package.json': '{"name":"price.api"}', 'services-price/package.json': '{"name":"price-api"}' }
  const { root, files } = await snapshot(t, tree)
  const clean = await detectProjects(root, files, 'acme/mono', [])
  const incremental = await detectProjects(root, files, 'acme/mono', clean.map(project => (
    { id: project.derivedId, productId: 'app', name: project.name, repo: 'acme/mono', sourcePath: project.path }
  )) as unknown as Component[])
  assert.deepEqual(clean.map(project => project.derivedId), ['price-api--services_hprice', 'price_dapi--services-price'])
  assert.deepEqual(incremental.map(project => project.derivedId), clean.map(project => project.derivedId))
  assert.deepEqual(incremental.map(project => project.existingComponentId), clean.map(project => project.derivedId))
})
