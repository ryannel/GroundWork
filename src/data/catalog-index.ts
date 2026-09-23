import { catalogId, type CatalogKind } from './catalog-identity.ts'
import type { Component } from './model.ts'

/**
 * What a relation asserts. Only `contract`, `trigger`, `step-ref` and `subject` are explicit links that may be
 * reversed; `owner` and `dependency` are structural and `trace` is already mirrored by the flow's `trigger`.
 */
export const relationKinds = ['owner', 'dependency', 'contract', 'trace', 'trigger', 'step-ref', 'subject'] as const
export type RelationKind = typeof relationKinds[number]
/** `reverse` marks a link derived from another entry's forward relation; `reason` is display text only. */
export type Relation = { id: string; kind: RelationKind; reverse: boolean; reason: string }
export type Entity = {
  id: string; kind: CatalogKind; localId: string; component: Component
  name: string; description: string; raw: Record<string, unknown>; related: Relation[]
}
const reversible = new Set<RelationKind>(['contract', 'trigger', 'step-ref', 'subject'])

export function catalogIndex(plan: { manifest: { id: string }; snapshot: { components: Component[] } }) {
  const entries: Entity[] = []
  // One relation per target, kind and direction; the first reason wins.
  const relate = (entry: Entity, id: string, kind: RelationKind, reason: string, reverse = false) => {
    const known = entry.related.some(relation => relation.id === id && relation.kind === kind && relation.reverse === reverse)
    if (!known) entry.related.push({ id, kind, reverse, reason })
  }
  for (const component of plan.snapshot.components) {
    const id = (kind: CatalogKind, entity: string) => catalogId(plan.manifest.id, component.id, kind, entity)
    const componentRef = (dependency: string) => catalogId(plan.manifest.id, dependency, 'component', dependency)
    const add = (kind: CatalogKind, raw: Record<string, unknown>, description = '') => {
      const localId = String(raw.id)
      const entry: Entity = { id: id(kind, localId), kind, localId, component, name: String(raw.name ?? raw.id), description, raw, related: [] }
      if (kind !== 'component') relate(entry, id('component', component.id), 'owner', 'Owned by component')
      entries.push(entry)
      return entry
    }
    const owner = add('component', component, component.description)
    for (const dependency of component.dependsOn ?? []) {
      relate(owner, componentRef(dependency), 'dependency', 'Mapped component dependency; not an endpoint-level call claim')
    }
    for (const endpoint of component.api?.endpoints ?? []) {
      const entry = add('endpoint', endpoint, endpoint.summary)
      for (const schema of component.api?.schemas ?? []) for (const side of ['request', 'response'] as const) {
        const names = (endpoint[side]?.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) as string[]
        if (names.includes(schema.name)) relate(entry, id('schema', schema.id), 'contract', `${side} contract`)
      }
      for (const flow of component.executionFlows ?? []) {
        if (flow.endpointId === endpoint.id) relate(entry, id('flow', flow.id), 'trace', 'Recorded execution path')
      }
    }
    for (const schema of component.api?.schemas ?? []) add('schema', schema, schema.description)
    for (const record of component.data?.records ?? []) add('data', record, record.description)
    for (const message of component.messaging?.messages ?? []) add('message', message, `${message.direction} ${message.broker} ${message.channel}`)
    for (const job of component.jobs ?? []) add('job', job, job.description)
    for (const finding of component.findings ?? []) {
      const entry = add('finding', finding, `${finding.question} ${finding.answer}`)
      for (const subject of finding.subjects) relate(entry, id(subject.kind, subject.id), 'subject', 'Investigated subject; may have since been removed')
    }
    for (const flow of component.executionFlows ?? []) {
      const entry = add('flow', flow, flow.summary)
      if (flow.endpointId) relate(entry, id('endpoint', flow.endpointId), 'trigger', 'Triggered by endpoint')
      else if (flow.trigger?.kind === 'message') relate(entry, id('message', flow.trigger.messageId), 'trigger', 'Triggered by message')
      else if (flow.trigger?.kind === 'job') relate(entry, id('job', flow.trigger.jobId), 'trigger', 'Triggered by job')
      for (const step of flow.steps) {
        const reason = `Referenced by step: ${step.title}`
        for (const record of step.dataRecordIds ?? []) relate(entry, id('data', record), 'step-ref', reason)
        for (const message of step.messageIds ?? []) relate(entry, id('message', message), 'step-ref', reason)
        for (const dependency of step.dependencyIds ?? []) relate(entry, componentRef(dependency), 'step-ref', reason)
      }
    }
  }
  // Reverse only explicit forward links, taken from a snapshot so a derived link is never reversed again.
  // Matching names/topics are candidates, never asserted relationships.
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const forward = entries.flatMap(entry => entry.related.filter(relation => reversible.has(relation.kind)).map(relation => ({ entry, relation })))
  for (const { entry, relation } of forward) {
    const target = byId.get(relation.id)
    // A target that already links to the source forward (endpoint → flow trace) needs no mirrored copy.
    if (!target || target === entry || target.related.some(existing => existing.id === entry.id && !existing.reverse)) continue
    relate(target, entry.id, relation.kind, `Referenced by ${entry.kind}: ${entry.name}`, true)
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id))
}

export function catalogSourceRevision(entry: Entity) {
  const evidence = (entry.raw.evidence ?? []) as NonNullable<Component['evidence']>
  const apiRevision = entry.kind === 'endpoint' || entry.kind === 'schema' ? entry.component.api?.sourceRevision : undefined
  const componentRevision = entry.component.sourceRevision ?? entry.component.scan?.revision
  return String(entry.raw.sourceRevision ?? evidence[0]?.revision ?? apiRevision ?? componentRevision ?? '') || null
}

/** The part of a catalog observation that a source-freshness check reads. */
export type SourceObservation = { id: string; repository: string | null; sourceRevision: string | null; raw: Record<string, unknown> }
export function sourceObservation(entry: Entity): SourceObservation {
  return { id: entry.id, repository: entry.component.repo ?? null, sourceRevision: catalogSourceRevision(entry), raw: entry.raw }
}
