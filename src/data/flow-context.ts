import type { ApiContract, FeatureSpec, FlowEdge, FlowNode, JourneyStep } from './spec.ts'

/** An action is the unit of system exploration, including when arriving from a test or deep link. */
export function resolveFlowAction(spec: FeatureSpec, trace?: string | null, nodeId?: string, contractId?: string): JourneyStep | undefined {
  const steps = spec.journey?.steps.filter(step => step.flow?.length) ?? []
  const [kind, id] = (trace ?? '').split(':')
  const explicit = kind === 'journey' ? steps.find(step => step.id === id) : undefined
  if (explicit) return explicit
  const test = kind === 'tests' ? spec.tests?.cases.find(test => test.id === id) : undefined
  const linked = test ? steps.filter(step => test.steps?.includes(step.id)) : steps
  const candidates = linked.length ? linked : steps
  const matching = candidates.find(step => {
    if (nodeId) return step.flow?.includes(nodeId)
    if (contractId) return actionFlow(spec, step).edges.some(edge => edge.contracts?.includes(contractId))
    return false
  })
  return matching ?? candidates[0]
}

/** Explicit action contracts override a boundary's list of all possible calls. */
export function actionFlow(spec: FeatureSpec, action?: JourneyStep): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (!action) return { nodes: [], edges: [] }
  const ids = new Set(action.flow ?? [])
  const nodes = (spec.flow?.nodes ?? []).filter(node => ids.has(node.id))
  const contracts = new Set((spec.api?.contracts ?? []).map(contract => contract.id))
  const edges = (spec.flow?.edges ?? []).filter(edge => ids.has(edge.from) && ids.has(edge.to) && (!action.flowEdges || action.flowEdges.includes(edge.id))).flatMap(edge => {
    if (!edge.contracts?.length) return [edge]
    const used = edge.contracts.filter(id => contracts.has(id) && (!action.contracts || action.contracts.includes(id)))
    return used.length ? [{ ...edge, contracts: used }] : []
  })
  return { nodes, edges }
}

export type FlowSelection = { kind: 'node'; node: FlowNode } | { kind: 'boundary'; edge: FlowEdge; contracts: ApiContract[]; selected?: string } | { kind: 'none' }

/** Never substitute an unrelated API for a decision, store, process, or stale selection. */
export function resolveFlowSelection(spec: FeatureSpec, action: JourneyStep | undefined, query: { node?: string; edge?: string; contract?: string }): FlowSelection {
  const flow = actionFlow(spec, action)
  if (query.node) {
    const node = flow.nodes.find(node => node.id === query.node)
    return node ? { kind: 'node', node } : { kind: 'none' }
  }
  const edge = query.edge ? flow.edges.find(edge => edge.id === query.edge) : query.contract ? flow.edges.find(edge => edge.contracts?.includes(query.contract!)) : undefined
  if (!edge?.contracts?.length) return { kind: 'none' }
  const contracts = (spec.api?.contracts ?? []).filter(c => edge.contracts!.includes(c.id))
  return contracts.length ? { kind: 'boundary', edge, contracts, selected: contracts.find(c => c.id === query.contract)?.id } : { kind: 'none' }
}
