import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogIndex } from '../src/data/catalog-index.ts'
import { componentMembership, createRepository, loadContent, pathPatternCovers, pathPatternsOverlap, productRepositories } from '../src/data/content.ts'
import { parsePlan } from '../server/format.ts'

const source = { layout: 'catalog-v3' as const,
  repository: { id: 'acme/home', origin: 'git@github.com:acme/home.git', provisional: false } }
const product = (id: string, repositories: unknown[], slug = id) => JSON.stringify({
  schemaVersion: 3, id, slug, name: id, kind: 'service-system', repositories,
})
const component = (id: string, repository: string, sourcePath: string) => JSON.stringify({
  schemaVersion: 3, id, name: id, repo: repository, sourcePath,
})

test('monorepo products own disjoint paths and shared used repositories remain visible in each product', () => {
  const files = {
    'products/price.json': product('price', [
      { repository: 'acme/mono', role: 'owned', paths: ['services/price', 'libs/price-*'] },
      { repository: 'acme/utils', role: 'used', aliases: ['acme/common-utils'] },
    ], 'price-display'),
    'products/tax.json': product('tax', [
      { repository: 'acme/mono', role: 'owned', paths: ['services/tax'] },
      { repository: 'acme/utils', role: 'used' },
    ]),
    'components/price-api.json': component('price-api', 'acme/mono', 'services/price/api'),
    'components/tax-api.json': component('tax-api', 'acme/mono', 'services/tax/api'),
    'components/price-lib.json': component('price-lib', 'acme/mono', 'libs/price-core'),
    'components/utils.json': component('utils', 'acme/common-utils', '.'),
  }
  const plan = parsePlan(files, source)
  assert.deepEqual(plan.snapshot.workspaces, [], 'a v3 home does not create a repository-local workspace')
  assert.equal(plan.snapshot.products[0].workspaceId, undefined)
  const { q } = createRepository(plan.snapshot)
  assert.deepEqual(q.components('price').map(item => item.id), ['price-api', 'price-lib', 'utils'])
  assert.deepEqual(q.components('tax').map(item => item.id), ['tax-api', 'utils'])
  assert.equal(q.componentOwner('utils'), undefined)
  assert.equal(q.componentOwner('price-api')?.id, 'price')
  assert.equal(q.componentOwner('price-api')?.slug, 'price-display', 'slug is display and routing, not identity')
  assert.deepEqual(catalogIndex(plan).find(item => item.component.id === 'utils' && item.kind === 'component')?.productIds,
    ['price', 'tax'])
})

test('v3 products load without a repository-local workspace and their slugs are unique within a home', () => {
  const documents = {
    'project.json': { schemaVersion: 1 },
    'products/a.json': { schemaVersion: 3, id: 'a', slug: 'api', name: 'API', kind: 'service-system', repositories: [] },
  }
  const snapshot = loadContent(documents, 'acme/home')
  assert.deepEqual(snapshot.workspaces, [])
  assert.equal(snapshot.products[0].workspaceId, undefined)
  assert.throws(() => loadContent({ ...documents,
    'products/b.json': { schemaVersion: 3, id: 'b', slug: 'api', name: 'Other API', kind: 'service-system', repositories: [] },
  }, 'acme/home'), /products.slug: duplicate/)
})

test('overlapping owned paths are rejected without requiring a catalog', () => {
  const files = {
    'products/price.json': product('price', [{ repository: 'acme/mono', role: 'owned', paths: ['libs/price-*'] }]),
    'products/other.json': product('other', [{ repository: 'acme/mono', role: 'owned', paths: ['libs/price-core'] }]),
  }
  assert.throws(() => parsePlan(files, source), /overlapping ownership.*acme\/mono/)
  assert.equal(pathPatternsOverlap('services/price', 'services/tax'), false)
  assert.equal(pathPatternsOverlap('libs/price-*', 'libs/price-core'), true)
  assert.equal(pathPatternCovers('libs/price-*', 'libs/price-core/src'), true)
})

test('repository alias cycles cannot make ownership depend on the lookup starting point', () => {
  const files = {
    'products/a.json': product('a', [{ repository: 'acme/a', role: 'owned', aliases: ['acme/b'] }]),
    'products/b.json': product('b', [{ repository: 'acme/b', role: 'owned', aliases: ['acme/a'] }]),
  }
  assert.throws(() => parsePlan(files, source), /repository alias cycle/)
})

test('parent validation compares product membership for used repositories', () => {
  const shared = {
    'products/a.json': product('a', [
      { repository: 'acme/home', role: 'owned' }, { repository: 'acme/x', role: 'used' },
    ]),
    'components/home.json': JSON.stringify({ id: 'home', name: 'Home', kind: 'service', repo: 'acme/home' }),
    'components/x.json': JSON.stringify({ id: 'x', name: 'X', kind: 'module', repo: 'acme/x', parentId: 'home' }),
  }
  assert.equal(parsePlan(shared, source).snapshot.components.length, 2,
    'a used component may be contained by a component in the same product')
  const disjoint = {
    'products/a.json': product('a', [{ repository: 'acme/x', role: 'used' }]),
    'products/b.json': product('b', [{ repository: 'acme/y', role: 'used' }]),
    'components/y.json': JSON.stringify({ id: 'y', name: 'Y', kind: 'service', repo: 'acme/y' }),
    'components/x.json': JSON.stringify({ id: 'x', name: 'X', kind: 'module', repo: 'acme/x', parentId: 'y' }),
  }
  assert.throws(() => parsePlan(disjoint, source), /parent must belong to the same product/)
})

test('product and catalog are valid independently, while legacy membership remains derived from productId', () => {
  const onlyProduct = parsePlan({ 'products/app.json': product('app', [{ repository: 'acme/source', role: 'owned' }]) }, source)
  assert.deepEqual(onlyProduct.snapshot.components, [])
  const onlyCatalog = parsePlan({ 'components/service.json': component('service', 'acme/source', 'src') }, source)
  assert.equal(onlyCatalog.snapshot.components[0].productId, undefined)
  assert.deepEqual(componentMembership(onlyCatalog.snapshot.components[0], [], source.repository.id).productIds, [])
  const explicitEmpty = parsePlan({
    'products/app.json': product('app', []),
    'components/home.json': component('home', 'acme/home', 'src'),
  }, source)
  assert.equal(explicitEmpty.snapshot.components[0].productId, undefined,
    'an explicit empty declaration does not silently claim the home repository')
  const legacy = parsePlan({
    'products/app.json': JSON.stringify({ id: 'app', slug: 'app', name: 'App', kind: 'service-system' }),
    'components/service.json': JSON.stringify({ id: 'service', productId: 'app', name: 'Service', repo: 'acme/source' }),
  }, source)
  assert.equal(legacy.snapshot.components[0].productId, 'app')
  assert.deepEqual(createRepository(legacy.snapshot).q.components('app').map(item => item.id), ['service'])
  assert.deepEqual(productRepositories(legacy.snapshot.products[0], legacy.snapshot.products,
    legacy.snapshot.components, source.repository.id), [
    { repository: 'acme/home', role: 'owned' }, { repository: 'acme/source', role: 'owned' },
  ])
  const freshLegacy = parsePlan({
    'products/app.json': JSON.stringify({ id: 'app', slug: 'app', name: 'App', kind: 'service-system' }),
    'components/home.json': JSON.stringify({ id: 'home', name: 'Home', repo: 'acme/home' }),
  }, source)
  assert.equal(freshLegacy.snapshot.components[0].productId, 'app', 'sole legacy product derives home ownership in memory')
})

test('a sole legacy product keeps home ownership after an external repository is scanned', () => {
  const plan = parsePlan({
    'products/api.json': JSON.stringify({ id: 'api', slug: 'api', name: 'API', kind: 'service-system' }),
    'components/external.json': JSON.stringify({ id: 'external', productId: 'api', name: 'External', repo: 'acme/external' }),
  }, source)
  assert.deepEqual(createRepository(plan.snapshot).q.productRepositories('api'), [
    { repository: 'acme/home', role: 'owned' }, { repository: 'acme/external', role: 'owned' },
  ])
  assert.equal(componentMembership({ repo: 'acme/home', sourcePath: 'src' }, plan.snapshot.products, source.repository.id).ownedBy, 'api')
})
