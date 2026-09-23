import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex } from '../src/data/spec-index.ts'
import type { FeatureSpec } from '../src/data/spec.ts'
import type { Checkout } from '../src/data/runtime.ts'
import { featureGaps, featureNextStep, invert, summarizeHubProducts, unlinkedBranches } from '../src/data/view-models.ts'
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
  checkoutId: 'c', root: '/r', repositoryRoot: '/r', repositories: ['/r'], components: [], productPath: null, projectId: null,
  name: 'n', planName: null, workspace: 'Personal', product: 'Suite', branch: 'main', head: null, features: [], error: null, ...patch,
})

test('hub products count each repository once through its primary checkout', () => {
  const features = [{ id: 'f1', title: 'A', stage: 'building' }, { id: 'f2', title: 'B', stage: 'idea' }, { id: 'f3', title: 'C', stage: 'shipped' }]
  const component = { id: 'api', name: 'API', repository: 'github.com/a/r', sourcePath: '.' }
  const [workspace, other] = summarizeHubProducts([
    checkout({ checkoutId: 'worktree', root: '/r/.worktrees/x', features, components: [component] }),
    checkout({ checkoutId: 'main', productPath: '/w/project/suite', features, components: [component] }),
    checkout({ checkoutId: 'broken', repositoryRoot: '/s', root: '/s', repositories: ['/s'], error: 'invalid plan' }),
    checkout({ checkoutId: 'lab', workspace: 'Lab', product: 'Notebook', repositoryRoot: '/n', root: '/n', repositories: ['/n'] }),
  ])
  assert.equal(workspace.name, 'Personal')
  assert.deepEqual(workspace.products, [{
    name: 'Suite', href: '/p/main/w/project/suite', components: 1, repositories: 1, active: 1, ideas: 1, shipped: 1,
  }])
  assert.equal(other.products[0].href, '/p/lab/')
  const [failed] = summarizeHubProducts([checkout({ error: 'invalid plan' })])[0].products
  assert.equal(failed.href, undefined, 'a product whose checkouts all failed is shown without a link')
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
