import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actionFlow, resolveFlowAction, resolveFlowSelection } from '../shared/flow-context.ts'
import { taxRulesSpec as spec } from './fixtures.ts'

const delivery = spec.journey!.steps.find(step => step.id === 'j2')!
const inspect = spec.journey!.steps.find(step => step.id === 'j4')!

test('an unscoped flow resolves to a concrete action, while a valid action remains selected', () => {
  assert.equal(resolveFlowAction(spec)?.id, 'j1')
  assert.equal(resolveFlowAction(spec, 'journey:j2', 'console')?.id, 'j2')
  assert.equal(resolveFlowAction({ flow: spec.flow }), undefined)
})
test('deep links find an action that actually includes the selected object', () => {
  assert.equal(resolveFlowAction(spec, undefined, 'console')?.id, 'j6')
  assert.equal(resolveFlowAction(spec, undefined, undefined, 'api-get-cart')?.id, 'j4')
})
test('a legacy test trace resolves to a journey action instead of a union of system paths', () => {
  const action = resolveFlowAction(spec, 'tests:E2E-3')!
  assert.ok(spec.tests!.cases.find(test => test.id === 'E2E-3')!.steps!.includes(action.id))
})
test('action paths omit unrelated work and restrict a shared boundary to the actual API call', () => {
  const flow = actionFlow(spec, delivery)
  assert.ok(!flow.nodes.some(node => node.id === 'console'))
  assert.deepEqual(flow.edges.find(edge => edge.id === 'e-sdk-cart')?.contracts, ['api-deliver-to'])
  assert.deepEqual(actionFlow(spec, inspect).edges.find(edge => edge.id === 'e-sdk-cart')?.contracts, ['api-get-cart'])
})
test('decision and database nodes never fall back to API contracts, even with stale API query params', () => {
  for (const id of ['region', 'cartdb', 'db']) {
    const selection = resolveFlowSelection(spec, delivery, { node: id, contract: 'api-quote' })
    assert.equal(selection.kind, 'node')
    if (selection.kind === 'node') assert.equal(selection.node.id, id)
  }
})
test('service boundaries expose only their action-scoped contracts', () => {
  const selection = resolveFlowSelection(spec, delivery, { edge: 'e-sdk-cart', contract: 'api-get-cart' })
  assert.equal(selection.kind, 'boundary')
  if (selection.kind === 'boundary') {
    assert.deepEqual(selection.contracts.map(c => c.id), ['api-deliver-to'])
    assert.equal(selection.selected, undefined)
  }
})
test('changing actions cannot display a stale node, boundary or API', () => {
  assert.equal(resolveFlowSelection(spec, inspect, { node: 'region' }).kind, 'none')
  assert.equal(resolveFlowSelection(spec, inspect, { edge: 'e-region-quote' }).kind, 'none')
  assert.equal(resolveFlowSelection(spec, delivery, { contract: 'api-get-cart' }).kind, 'none')
  assert.equal(resolveFlowSelection(spec, delivery, {}).kind, 'none')
})
test('authored decision outcomes reference outgoing edges and show both branches', () => {
  const decision = spec.flow!.nodes.find(node => node.id === 'region')!
  assert.equal(decision.logic!.branches.length, 2)
  assert.ok(decision.logic!.branches.every(branch => spec.flow!.edges.some(edge => edge.id === branch.edgeId && edge.from === decision.id)))
})

test('each example starts with its actor, reaches every node, and uses distinct diagram positions', () => {
  for (const action of spec.journey!.steps) {
    const flow = actionFlow(spec, action)
    const start = flow.nodes.find(node => node.kind === 'external')!
    assert.ok(start, `${action.id} has an entry point`)
    const reachable = new Set([start.id])
    for (let i = 0; i < flow.nodes.length; i++) {
      for (const edge of flow.edges) if (reachable.has(edge.from)) reachable.add(edge.to)
    }
    assert.equal(reachable.size, flow.nodes.length, `${action.id} has no disconnected nodes`)
    assert.equal(new Set(flow.nodes.map(node => `${node.col}:${node.row}`)).size, flow.nodes.length, `${action.id} has no overlapping nodes`)
    assert.ok(action.result, `${action.id} explains the observable result`)
  }
})
test('adding an item saves pending tax after the decision; reading the breakdown never writes', () => {
  const add = actionFlow(spec, spec.journey!.steps.find(step => step.id === 'j1')!)
  assert.deepEqual(add.edges.filter(edge => edge.to === 'cartdb').map(edge => edge.from), ['placeholder'])
  assert.deepEqual(add.edges.find(edge => edge.id === 'e-sdk-cart')!.contracts, ['api-add-line'])
  const read = actionFlow(spec, inspect)
  assert.deepEqual(read.edges.map(edge => edge.id).sort(), ['e-cart-read', 'e-sdk-cart'])
})
test('checkout includes the same complete quote, rules and persistence path as setting the region', () => {
  const checkout = actionFlow(spec, spec.journey!.steps.find(step => step.id === 'j5')!)
  assert.deepEqual(checkout, actionFlow(spec, delivery))
})
