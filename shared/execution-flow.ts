import type { Component } from './model.ts'
import { referenceKey, referenceLabel, type ComponentReference } from './component-reference.ts'
import { githubRepository } from './repository-identity.ts'
import { isRepoRelativePath } from './schema-primitives.ts'

export type ExecutionFlow = NonNullable<Component['executionFlows']>[number]
export type ExecutionStep = ExecutionFlow['steps'][number]

/**
 * Flow links belong to the component catalog, independently of feature-planning diagrams. `repositories` says which
 * repository each catalogued component belongs to, so a step may cite a dependency in whichever form the component
 * declares it: a bare name and a `{repository, component}` reference that resolve to the same component are the
 * same dependency. Without it, and for a reference nothing resolves, the forms are compared as written.
 */
export function executionFlowIssues(component: Component, repositories?: Map<string, string | undefined>): string[] {
  const issues: string[] = []
  const unique = (values: string[], name: string) => { if (new Set(values).size !== values.length) issues.push(`duplicate ${name}`) }
  unique((component.jobs ?? []).map(job => job.id), 'job IDs')
  unique((component.executionFlows ?? []).map(flow => flow.id), 'execution flow IDs')
  for (const flow of component.executionFlows ?? []) {
    const fail = (reason: string) => issues.push(`${flow.id}: ${reason}`)
    if (!!flow.endpointId === !!flow.trigger) fail('Specify exactly one endpoint or non-HTTP trigger')
    if (flow.endpointId && !component.api?.endpoints.some(endpoint => endpoint.id === flow.endpointId)) fail(`unknown endpoint ${flow.endpointId}`)
    const trigger = flow.trigger
    if (trigger?.kind === 'message') {
      const inbound = component.messaging?.messages.some(message => message.id === trigger.messageId && message.direction === 'inbound')
      if (!inbound) fail('Message trigger requires an inbound message in this component')
    }
    if (flow.trigger?.kind === 'job' && !component.jobs?.some(job => job.id === (flow.trigger as { jobId: string }).jobId)) fail('Unknown job trigger')
    unique(flow.steps.map(step => step.id), `${flow.id} step IDs`)
    unique(flow.transitions.map(edge => edge.id), `${flow.id} transition IDs`)
    const ids = new Set(flow.steps.map(step => step.id))
    if (!ids.has(flow.entryStepId)) fail('entry step does not exist')
    for (const step of flow.steps) {
      for (const id of step.dataRecordIds ?? []) if (!component.data?.records.some(record => record.id === id)) fail(`${step.id}: unknown data record ${id}`)
      for (const id of step.messageIds ?? []) if (!component.messaging?.messages.some(message => message.id === id)) fail(`${step.id}: unknown message ${id}`)
      const key = (reference: ComponentReference) => referenceKey(reference, repositories)
      const declared = new Set((component.dependsOn ?? []).map(key))
      for (const reference of step.dependencyIds ?? []) {
        // A step may only cite a dependency the component declares. Equivalence is decided by what each reference
        // resolves to, so the two forms of one dependency match and an unresolved one stays explicit.
        if (!declared.has(key(reference))) fail(`${step.id}: unknown dependency ${referenceLabel(reference)}`)
      }
      for (const name of step.unresolvedDependencyNames ?? []) {
        if (!component.unresolvedDependencies?.some(dependency => dependency.name === name)) fail(`${step.id}: unknown unresolved dependency ${name}`)
      }
    }
    for (const edge of flow.transitions) if (!ids.has(edge.from) || !ids.has(edge.to)) fail(`${edge.id}: transition leaves the flow`)
    for (const item of [...flow.steps, ...flow.transitions]) for (const evidence of item.evidence) {
      if ((!evidence.repository || evidence.repository === component.repo) && evidence.revision !== flow.sourceRevision) {
        fail(`${item.id}: evidence revision differs from the flow revision`)
      }
      if (!isRepoRelativePath(evidence.path)) fail(`${item.id}: evidence path must be repository-relative`)
      const [start, end = start] = evidence.lines.split('-').map(Number)
      if (start < 1 || end < start) fail(`${item.id}: invalid evidence line range`)
    }
    const reachable = new Set<string>()
    const pending = [flow.entryStepId]
    while (pending.length) {
      const id = pending.pop()!
      if (reachable.has(id)) continue
      reachable.add(id)
      pending.push(...flow.transitions.filter(edge => edge.from === id).map(edge => edge.to))
    }
    for (const id of ids) if (!reachable.has(id)) fail(`${id}: step is unreachable from entry`)
  }
  return issues
}

export function sourceEvidenceUrl(repository: string | undefined, evidence: ExecutionStep['evidence'][number]) {
  repository = evidence.repository ?? repository
  if (!repository) return undefined
  const github = githubRepository(repository)
  if (!github) return undefined
  const [start, end] = evidence.lines.split('-')
  const filePath = evidence.path.split('/').map(encodeURIComponent).join('/')
  return `https://github.com/${github}/blob/${evidence.revision}/${filePath}#L${start}${end ? `-L${end}` : ''}`
}
