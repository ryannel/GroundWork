import { catalogId, type CatalogKind } from './catalog-identity.ts'
import type { Component } from './model.ts'
export type Entity = { id: string; kind: CatalogKind; localId: string; component: Component; name: string; description: string; raw: Record<string, unknown>; related: { id: string; reason: string }[] }
export function catalogIndex(plan: { manifest: { id: string }; snapshot: { components: Component[] } }) {
  const entries: Entity[] = []
  for (const component of plan.snapshot.components) {
    const id = (kind: CatalogKind, entity: string) => catalogId(plan.manifest.id, component.id, kind, entity)
    const add = (kind: CatalogKind, raw: Record<string, unknown>, description = '') => {
      const entry: Entity = { id: id(kind, String(raw.id)), kind, localId: String(raw.id), component, name: String(raw.name ?? raw.id), description, raw, related: [] }
      if (kind !== 'component') entry.related.push({ id: id('component', component.id), reason: 'Owned by component' })
      entries.push(entry)
      return entry
    }
    const owner = add('component', component, component.description)
    for (const dependency of component.dependsOn ?? []) owner.related.push({ id: catalogId(plan.manifest.id, dependency, 'component', dependency), reason: 'Mapped component dependency; not an endpoint-level call claim' })
    for (const endpoint of component.api?.endpoints ?? []) {
      const entry = add('endpoint', endpoint, endpoint.summary)
      for (const schema of component.api?.schemas ?? []) for (const side of ['request', 'response'] as const) {
        if (((endpoint[side]?.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) as string[]).includes(schema.name)) entry.related.push({ id: id('schema', schema.id), reason: `${side} contract` })
      }
      for (const flow of component.executionFlows ?? []) if (flow.endpointId === endpoint.id) entry.related.push({ id: id('flow', flow.id), reason: 'Recorded execution path' })
    }
    for (const schema of component.api?.schemas ?? []) add('schema', schema, schema.description)
    for (const record of component.data?.records ?? []) add('data', record, record.description)
    for (const message of component.messaging?.messages ?? []) add('message', message, `${message.direction} ${message.broker} ${message.channel}`)
    for (const job of component.jobs ?? []) add('job', job, job.description)
    for (const finding of component.findings ?? []) {
      const entry = add('finding', finding, `${finding.question} ${finding.answer}`)
      for (const subject of finding.subjects) entry.related.push({ id: id(subject.kind, subject.id), reason: 'Investigated subject; may have since been removed' })
    }
    for (const flow of component.executionFlows ?? []) {
      const entry = add('flow', flow, flow.summary)
      if (flow.endpointId) entry.related.push({ id: id('endpoint', flow.endpointId), reason: 'Triggered by endpoint' })
      else if (flow.trigger?.kind === 'message') entry.related.push({ id: id('message', flow.trigger.messageId), reason: 'Triggered by message' })
      else if (flow.trigger?.kind === 'job') entry.related.push({ id: id('job', flow.trigger.jobId), reason: 'Triggered by job' })
      for (const step of flow.steps) {
        for (const record of step.dataRecordIds ?? []) entry.related.push({ id: id('data', record), reason: `Referenced by step: ${step.title}` })
        for (const message of step.messageIds ?? []) entry.related.push({ id: id('message', message), reason: `Referenced by step: ${step.title}` })
        for (const dependency of step.dependencyIds ?? []) entry.related.push({ id: catalogId(plan.manifest.id, dependency, 'component', dependency), reason: `Referenced by step: ${step.title}` })
      }
    }
  }
  // Reverse only explicit links. Matching names/topics are candidates, never asserted relationships.
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  for (const entry of entries) for (const relation of [...entry.related]) {
    if (relation.reason.startsWith('Investigated subject') || relation.reason.startsWith('Referenced by') || relation.reason.startsWith('Triggered by') || relation.reason.endsWith('contract')) byId.get(relation.id)?.related.push({ id: entry.id, reason: `Referenced by ${entry.kind}: ${entry.name}` })
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id))
}


export function catalogSourceRevision(entry: Entity) {
  const evidence = (entry.raw.evidence ?? []) as NonNullable<Component['evidence']>
  return String(entry.raw.sourceRevision ?? evidence[0]?.revision ?? (entry.kind === 'endpoint' || entry.kind === 'schema' ? entry.component.api?.sourceRevision : undefined) ?? entry.component.sourceRevision ?? entry.component.scan?.revision ?? '') || null
}
