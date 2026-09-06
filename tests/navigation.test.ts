import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taxRulesSpec as spec } from './fixtures.ts'

test('every authored feature cross-reference has a real destination', () => {
  const check = (owner: string, refs: string[] | undefined, targets: { id: string }[] | undefined) => {
    for (const id of refs ?? []) assert.ok(targets?.some(item => item.id === id), `${owner} links to missing ${id}`)
  }
  for (const step of spec.journey?.steps ?? []) {
    check(step.id, step.flow, spec.flow?.nodes)
    check(step.id, step.flowEdges, spec.flow?.edges)
    check(step.id, step.contracts, spec.api?.contracts)
    check(step.id, step.design ? [step.design] : [], spec.design?.mockups)
  }
  for (const edge of spec.flow?.edges ?? []) {
    check(edge.id, [edge.from, edge.to], spec.flow?.nodes)
    check(edge.id, edge.contracts, spec.api?.contracts)
  }
  for (const node of spec.flow?.nodes ?? []) check(node.id, node.tables, spec.storage?.tables)
  for (const scenario of spec.tests?.cases ?? []) {
    check(scenario.id, scenario.steps, spec.journey?.steps)
    check(scenario.id, scenario.contracts, spec.api?.contracts)
    check(scenario.id, scenario.tables, spec.storage?.tables)
  }
  for (const criterion of spec.purpose?.success ?? []) check(criterion.id, criterion.tests, spec.tests?.cases)
})
