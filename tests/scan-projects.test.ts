import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import {
  catalogMetadata, detectProjects, filesForProject, isTestSegment, packetFiles, type DetectedProject, type InventoryFile,
} from '../server/scan-projects.ts'
import type { Component } from '../src/data/model.ts'
import { tempDir, writeFiles } from './helpers.ts'

const file = (value: string): InventoryFile => ({ path: value, digest: 'a'.repeat(40), bytes: 1 })
const project = (value: string, manifest = `${value === '.' ? '' : `${value}/`}package.json`): DetectedProject =>
  ({ path: value, name: value, suggestedId: value, manifest })

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
  assert.deepEqual(await detectProjects(root, files, 'acme/orders', []), [{ path: '.', name: 'Orders API', suggestedId: 'orders-api', manifest: 'catalog-info.yaml' }])
  const existing = [{ id: 'orders', productId: 'app', name: 'Orders', repo: 'acme/orders' }] as Component[]
  assert.equal((await detectProjects(root, files, 'acme/orders', existing))[0].existingComponentId, 'orders')
})

test('detectProjects finds manifests outside test directories and disambiguates duplicate IDs', async t => {
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
  assert.match(a.suggestedId, /^api-[a-f0-9]{6}$/)
  assert.match(b.suggestedId, /^api-[a-f0-9]{6}$/)
  assert.notEqual(a.suggestedId, b.suggestedId)
})

test('a registered repository-wide component absorbs library projects and falls back to a solution file', async t => {
  const { root, files } = await snapshot(t, { 'App.sln': '', 'Core/Core.csproj': '<Project />', 'Web/Web.csproj': '<Project />' })
  const existing = [{ id: 'app', productId: 'app', name: 'App', repo: '/work/app' }] as Component[]
  assert.deepEqual(await detectProjects(root, files, '/work/app', existing), [
    { path: '.', name: 'App', suggestedId: 'app', existingComponentId: 'app', manifest: 'App.sln' },
  ])
})
