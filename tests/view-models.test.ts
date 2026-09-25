import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex } from '../shared/spec-index.ts'
import type { FeatureSpec } from '../shared/spec.ts'
import type { Checkout } from '../src/data/runtime.ts'
import { featureGaps, featureNextStep, invert, productRoute, routesKey, summarizeHubProducts, unlinkedBranches } from '../shared/view-models.ts'
import { taxRulesSpec } from './fixtures.ts'

const next = (spec: FeatureSpec) => featureNextStep(spec, buildIndex(spec))
const purpose = { problem: 'Totals are wrong', outcome: 'Correct totals', success: [{ id: 'c1', text: 'Tax is shown.', tests: ['t1'] }] }
const testCase = (id: string, status?: 'planned' | 'passing') => ({ id, title: id, given: 'g', when: 'w', then: ['t'], ...(status ? { status } : {}) })

test('a feature without a brief starts with the brief', () => {
  const step = next({})
  assert.equal(step.heading, 'Shape the brief')
  assert.equal(step.section, 'purpose')
  assert.equal(step.linkLabel, 'Start with the brief')
})

test('coverage gaps outrank test evidence and name the first unproven criterion', () => {
  const one = next({ purpose: { ...purpose, success: [{ id: 'c1', text: 'Tax is shown at checkout.' }] } })
  assert.equal(one.gaps, 1)
  assert.equal(one.heading, 'Close the validation gaps')
  assert.equal(one.body, '1 item has no linked test: Tax is shown at checkout.')
  assert.equal(one.section, 'tests')
  const many = next({ purpose: { ...purpose, success: [{ id: 'c1', text: 'First' }, { id: 'c2', text: 'Second' }] } })
  assert.equal(many.body, '2 items have no linked test. One gap: First.')
})

test('once covered, the next step follows the test evidence', () => {
  assert.equal(next({ purpose: { problem: 'p', outcome: 'o' } }).heading, 'Plan the validation')
  const partly = next({ purpose, tests: { cases: [testCase('t1', 'passing'), testCase('t2', 'planned')] } })
  assert.equal(partly.gaps, 0)
  assert.equal(partly.heading, 'Review test evidence')
  assert.equal(partly.body, '1 of 2 tests are not marked passing yet.')
  assert.deepEqual([partly.cases, partly.passing], [2, 1])
  const done = next({ purpose, tests: { cases: [testCase('t1', 'passing')] } })
  assert.equal(done.heading, 'Review the plan')
})

test('feature gaps count removed stored records as settled', () => {
  const ix = buildIndex(taxRulesSpec)
  const gaps = featureGaps(taxRulesSpec, ix)
  const untestedTables = (taxRulesSpec.storage?.tables ?? []).filter(t => t.change !== 'removed' && !ix.tableTests[t.id]?.length).length
  assert.equal(gaps, ix.untestedSteps.length + ix.untestedContracts.length + ix.unprovenCriteria.length + untestedTables)
})

const checkout = (patch: Partial<Checkout>): Checkout => ({
  repositoryId: 'acme/home', homeRepositoryId: 'acme/home', productId: 'suite',
  productRefs: [{ repository: 'acme/home', product: 'suite', slug: 'suite', name: 'Suite', path: '/r/acme%2Fhome/suite',
    workspaceNames: ['Personal'], componentIds: ['api'], componentKeys: ['acme/home#api'],
    declaredRepositories: ['acme/home'], features: [] }],
  workspaceNames: ['Personal'], preferred: false, authoritativeHome: false,
  checkoutId: 'c', root: '/r', repositoryRoot: '/r', repositories: ['/r'], components: [], productPath: null, projectId: null,
  name: 'n', planName: null, workspace: 'Personal', product: 'Suite', branch: 'main', head: null, features: [], error: null, ...patch,
})

test('hub products count each repository once through its primary checkout', () => {
  const features = [{ id: 'f1', title: 'A', stage: 'building' }, { id: 'f2', title: 'B', stage: 'idea' }, { id: 'f3', title: 'C', stage: 'shipped' }]
  const component = { id: 'api', name: 'API', repository: 'github.com/a/r', sourcePath: '.' }
  const [workspace, other] = summarizeHubProducts([
    checkout({ checkoutId: 'worktree', root: '/r/.worktrees/x', features, components: [component] }),
    checkout({ checkoutId: 'main', preferred: true, authoritativeHome: true, features, components: [component], productRefs: [{
      repository: 'acme/home', product: 'suite', slug: 'suite', name: 'Suite', path: '/r/acme%2Fhome/suite', workspaceNames: ['Personal'],
      componentIds: ['api'], componentKeys: ['acme/home#api'], declaredRepositories: ['acme/home'], features,
    }] }),
    checkout({ checkoutId: 'broken', repositoryRoot: '/s', root: '/s', repositories: ['/s'], error: 'invalid plan' }),
    checkout({ checkoutId: 'lab', repositoryId: 'acme/notebook', authoritativeHome: true, workspace: 'Lab', product: 'Notebook',
      repositoryRoot: '/n', root: '/n', repositories: ['/n'],
      productRefs: [{ repository: 'acme/notebook', product: 'notebook', slug: 'notebook', name: 'Notebook',
        path: '/r/acme%2Fnotebook/notebook', workspaceNames: ['Lab'], componentIds: [], componentKeys: [],
        declaredRepositories: ['acme/notebook'], features: [] }] }),
  ])
  assert.equal(workspace.name, 'Personal')
  assert.deepEqual(workspace.products, [{
    id: '["acme/home","suite"]', name: 'Suite', href: '/p/main/r/acme%2Fhome/suite', components: 1, repositories: 1, active: 1, ideas: 1, shipped: 1,
  }])
  assert.equal(other.products[0].href, '/p/lab/r/acme%2Fnotebook/notebook')
  const [failed] = summarizeHubProducts([checkout({ error: 'invalid plan' })])[0].products
  assert.equal(failed.href, undefined, 'a product whose checkouts all failed is shown without a link')
})

test('Hub opens the authoritative product home when a preferred clone has no catalog', () => {
  const scoped = { repository: 'acme/home', product: 'suite', slug: 'suite', name: 'Suite', path: productRoute('acme/home', 'suite'),
    workspaceNames: ['Personal'], componentIds: ['api'], componentKeys: ['acme/home#api'], declaredRepositories: ['acme/home'],
      features: [{ id: 'f1', title: 'Shipping', stage: 'building' }] }
  const [view] = summarizeHubProducts([
    checkout({ checkoutId: 'newest', preferred: true, productRefs: [{ ...scoped, features: [] }], planName: null, error: null }),
    checkout({ checkoutId: 'catalog', authoritativeHome: true, root: '/r/.worktrees/catalog', productRefs: [scoped], planName: 'Home' }),
  ])
  assert.equal(view.products[0].href, '/p/catalog/r/acme%2Fhome/suite')
  assert.equal(view.products[0].active, 1)
  const [missingHome] = summarizeHubProducts([checkout({ checkoutId: 'newest', preferred: true, productRefs: [{ ...scoped, features: [] }] })])[0].products
  assert.equal(missingHome.href, undefined)
})

test('hub workspace membership is per exact product reference, including duplicate names', () => {
  const refs = [
    { repository: 'acme/home', product: 'a', slug: 'a', name: 'Suite', path: productRoute('acme/home', 'a'),
      workspaceNames: ['Team'], componentIds: [], componentKeys: [], declaredRepositories: ['acme/home'], features: [] },
    { repository: 'acme/home', product: 'b', slug: 'b', name: 'Suite', path: productRoute('acme/home', 'b'),
      workspaceNames: ['Lab'], componentIds: [], componentKeys: [], declaredRepositories: ['acme/home'], features: [] },
  ]
  const views = summarizeHubProducts([checkout({ productRefs: refs })])
  assert.deepEqual(views.map(view => [view.name, view.products.map(product => product.id)]), [
    ['Team', ['["acme/home","a"]']], ['Lab', ['["acme/home","b"]']],
  ])
  assert.equal(productRoute('host.example/Acme/API', 'A B'), '/r/host.example%2FAcme%2FAPI/A%20B')
})

test('new home products without workspace assignment remain visible in the Hub', () => {
  const ref = { repository: 'acme/home', product: 'new', slug: 'new', name: 'New', path: productRoute('acme/home', 'new'),
    workspaceNames: [], componentIds: [], componentKeys: [], declaredRepositories: ['acme/home'], features: [] }
  const [view] = summarizeHubProducts([checkout({ productRefs: [ref], authoritativeHome: true })])
  assert.equal(view.name, 'Other products')
  assert.equal(view.products[0].href, '/p/c/r/acme%2Fhome/new')
})

test('a v3 source-only registry does not invent a product from old display labels', () => {
  assert.deepEqual(summarizeHubProducts([checkout({ productRefs: [] })]), [])
})

test('Hub metrics are scoped to each product and source repository', () => {
  const refs = [
    { repository: 'acme/home', product: 'a', slug: 'a', name: 'A', path: productRoute('acme/home', 'a'),
      workspaceNames: ['Team'], componentIds: ['one'], componentKeys: ['acme/home#one'],
      declaredRepositories: ['acme/home'], features: [{ id: 'f1', title: 'F1', stage: 'building' }] },
    { repository: 'acme/home', product: 'b', slug: 'b', name: 'B', path: productRoute('acme/home', 'b'),
      workspaceNames: ['Team'], componentIds: ['two'], componentKeys: ['acme/home#two'],
      declaredRepositories: ['acme/home'], features: [{ id: 'f2', title: 'F2', stage: 'idea' }] },
  ]
  const [view] = summarizeHubProducts([checkout({ productRefs: refs, authoritativeHome: true })])
  assert.deepEqual(view.products.map(product => [product.name, product.components, product.active, product.ideas]), [
    ['A', 1, 1, 0], ['B', 1, 0, 1],
  ])
})

test('Hub counts locally catalogued unregistered components once across home and source checkouts', () => {
  const homeRef = { repository: 'acme/home', product: 'suite', slug: 'suite', name: 'Suite', path: productRoute('acme/home', 'suite'),
    workspaceNames: ['Personal'], componentIds: ['shared', 'other'],
    componentKeys: ['acme/source#shared', 'acme/unregistered#other'], declaredRepositories: ['acme/source', 'acme/unregistered'], features: [] }
  const sourceRef = { ...homeRef, componentIds: ['shared'], componentKeys: ['acme/source#shared'] }
  const [view] = summarizeHubProducts([
    checkout({ checkoutId: 'home', authoritativeHome: true, productRefs: [homeRef] }),
    checkout({ checkoutId: 'source', repositoryId: 'acme/source', productRefs: [sourceRef] }),
  ])
  assert.equal(view.products[0].components, 2)
  assert.equal(view.products[0].repositories, 2)
})

test('Hub repository count follows product declarations including uncloned used repos, without assuming home ownership', () => {
  const ref = { repository: 'acme/catalog-home', product: 'suite', slug: 'suite', name: 'Suite',
    path: productRoute('acme/catalog-home', 'suite'), workspaceNames: ['Personal'], componentIds: [], componentKeys: [],
    declaredRepositories: ['acme/source-owned', 'acme/used-uncloned'], features: [] }
  const [view] = summarizeHubProducts([checkout({ repositoryId: 'acme/catalog-home', authoritativeHome: true, productRefs: [ref] })])
  assert.equal(view.products[0].repositories, 2)
  assert.equal(view.products[0].href, '/p/c/r/acme%2Fcatalog-home/suite')
})

test('unlinked branches exclude branches a delivery links, so an all-linked checkout lists none', () => {
  const delivery = { f1: { branches: [{ branch: 'feat/a' }] } } as never
  assert.deepEqual(unlinkedBranches({ delivery, activity: { branches: ['main', 'feat/a'] } }), ['main'])
  assert.deepEqual(unlinkedBranches({ delivery, activity: { branches: ['feat/a'] } }), [])
})

test('invert builds a reverse index that tolerates Object.prototype names as IDs', () => {
  const reversed = invert({ t1: ['constructor', 'c1'], t2: ['c1', 'toString'] })
  assert.deepEqual(reversed.get('c1'), ['t1', 't2'])
  assert.deepEqual(reversed.get('constructor'), ['t1'])
  assert.deepEqual(reversed.get('toString'), ['t2'])
  assert.equal(reversed.get('hasOwnProperty'), undefined)
})

test('the routes key follows the checkout, not the plan revision', () => {
  const plan = (token: string, revision: string) => ({ revision, context: { token, revision } })
  assert.equal(routesKey(plan('checkout-a', 'r1')), routesKey(plan('checkout-a', 'r2')))
  assert.notEqual(routesKey(plan('checkout-a', 'r1')), routesKey(plan('checkout-b', 'r1')))
  assert.equal(routesKey(null), 'unavailable')
})
