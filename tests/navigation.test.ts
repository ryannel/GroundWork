import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentContext, validateFeatureSpec } from '../src/data/content.ts'
import { livePrototypeIds } from '../src/data/live-prototypes.ts'
import { snapshot } from './fixtures.ts'

// loadContent already proves the fixture's links resolve; these tests exercise the feature rule on its own.
const ctx = contentContext(snapshot, livePrototypeIds)
const feature = () => structuredClone(snapshot.features.find(f => f.id === 'f-2')!)

test('every authored feature cross-reference has a real destination', () => {
  assert.deepEqual(validateFeatureSpec(feature(), ctx), [])
})

test('the feature rule reports each dangling link with its file and path', () => {
  const broken = feature()
  const spec = broken.spec!
  spec.journey!.steps[0].flow = ['missing-node']
  spec.tests!.cases[0].contracts = ['missing-contract']
  spec.purpose!.success![0].tests = ['missing-test']
  const issues = validateFeatureSpec(broken, ctx)
  assert.ok(issues.includes(`features/f-2/journey.json:${spec.journey!.steps[0].id}.flow: unknown flow reference "missing-node"`), issues.join('\n'))
  assert.ok(issues.includes(`features/f-2/tests.json:${spec.tests!.cases[0].id}.contracts: unknown api reference "missing-contract"`), issues.join('\n'))
  assert.ok(issues.includes(`features/f-2/purpose.json:${spec.purpose!.success![0].id}.tests: unknown tests reference "missing-test"`), issues.join('\n'))
})
