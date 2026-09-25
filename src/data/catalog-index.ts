import {
  catalogId, catalogIdForms, emptyLegacyIdMap, legacyIdForms, legacyIdIndex, legacyIdMapFromProjection, legacyIdProjection,
  legacyScopeKey, translateCatalogId,
  type CatalogKind, type LegacyIdMap, type LegacyIdProjection,
} from './catalog-identity.ts'
import { componentRepositories, referenceLabel, resolveComponentReference } from './component-reference.ts'
import { identitySlug, repositoryIdentity } from './repository-identity.ts'
import type { Component } from './model.ts'

/**
 * The storage layout a home was read from. Only a migrated (`catalog-v3`) home qualifies its catalog IDs by
 * repository; the others keep the project-qualified form every document already stores.
 */
export type CatalogLayout = 'legacy' | 'catalog-v1' | 'catalog-v3'

/**
 * What a relation asserts. Only `contract`, `trigger`, `step-ref` and `subject` are explicit links that may be
 * reversed; `owner` and `dependency` are structural and `trace` is already mirrored by the flow's `trigger`.
 */
export const relationKinds = ['owner', 'dependency', 'contract', 'trace', 'trigger', 'step-ref', 'subject'] as const
export type RelationKind = typeof relationKinds[number]
/**
 * `reverse` marks a link derived from another entry's forward relation; `reason` is display text only.
 * `unresolved` marks a reference no catalogued component answers to: it is kept as written and shown as
 * unresolved rather than qualified with a repository it may not belong to.
 */
export type Relation = { id: string; kind: RelationKind; reverse: boolean; reason: string; unresolved?: boolean }
export type Entity = {
  id: string; kind: CatalogKind; localId: string; component: Component
  /** The entity's other ID forms: the migrated `repository/component/kind/entity` one, or the legacy ones it replaced. */
  aliases: string[]
  name: string; description: string; raw: Record<string, unknown>; related: Relation[]
}
const reversible = new Set<RelationKind>(['contract', 'trigger', 'step-ref', 'subject'])

/**
 * The catalog a home holds, with the facts that decide which ID form is canonical. In a migrated (`catalog-v3`)
 * home the canonical ID is qualified by the repository the component lives in, and the legacy IDs that resolved to
 * it are its aliases. In a legacy or split-v1 home `manifest.id` stays the canonical scope, because that is what
 * every stored document, baseline and scan manifest already holds, and the repository-qualified form is an alias.
 * Either way `repository` is the home's own identity, which qualifies components that name no repository.
 */
export interface IndexedPlan {
  manifest: { id: string }
  snapshot: { components: Component[] }
  repository?: { id: string }
  legacyIds?: LegacyIdMap
  layout?: CatalogLayout
}

/**
 * Everything outside the documents that decides which IDs a catalog answers to, in a form that survives JSON. The
 * viewer receives it beside the snapshot: a `LegacyIdMap` does not serialise, so without this projection a viewer
 * could only pass the manifest ID and would report an entry an older baseline names as removed while the service
 * reports it unchanged.
 */
export interface CatalogIdentity {
  manifest: { id: string }
  repository?: { id: string }
  layout?: CatalogLayout
  legacyIds?: LegacyIdProjection
}
export const catalogIdentity = (plan: CatalogScope): CatalogIdentity => {
  const source = indexedScope(plan)
  return {
    manifest: { id: source.manifest.id },
    ...(source.repository ? { repository: { id: source.repository.id } } : {}),
    ...(source.layout ? { layout: source.layout } : {}),
    ...(source.legacyIds ? { legacyIds: legacyIdProjection(source.legacyIds) } : {}),
  }
}
/** What a catalog can be indexed against: a bare legacy project ID, a parsed plan, or the projection of one. */
export type CatalogScope = string | Omit<IndexedPlan, 'snapshot'> | CatalogIdentity
const isLegacyIdMap = (value: LegacyIdMap | LegacyIdProjection): value is LegacyIdMap => value.ids instanceof Map
/** The indexing facts of any scope form, so every caller reaches the same aliases. */
export function indexedScope(scope: CatalogScope): Omit<IndexedPlan, 'snapshot'> {
  if (typeof scope === 'string') return { manifest: { id: scope } }
  const legacyIds = scope.legacyIds
  if (!legacyIds) return scope as Omit<IndexedPlan, 'snapshot'>
  return { ...scope, legacyIds: isLegacyIdMap(legacyIds) ? legacyIds : legacyIdMapFromProjection(legacyIds) }
}

export function catalogIndex(plan: IndexedPlan) {
  const entries: Entity[] = []
  const legacyIds = plan.legacyIds ?? emptyLegacyIdMap()
  // A migrated home reads its legacy IDs backwards: it stores the migrated form and must answer to what it replaced.
  const migrated = plan.layout === 'catalog-v3'
  const index = legacyIdIndex(legacyIds)
  const home = plan.repository?.id
  const repositories = componentRepositories(plan.snapshot.components, home)
  /** The scope the canonical ID of a component takes, which is the repository's identity only in a migrated home. */
  const canonicalScope = (repository: string | undefined) => migrated ? repository ?? home ?? plan.manifest.id : plan.manifest.id
  // One relation per target, kind and direction; the first reason wins.
  const relate = (entry: Entity, id: string, kind: RelationKind, reason: string, reverse = false, unresolved = false) => {
    const known = entry.related.some(relation => relation.id === id && relation.kind === kind && relation.reverse === reverse)
    if (!known) entry.related.push({ id, kind, reverse, reason, ...(unresolved ? { unresolved: true } : {}) })
  }
  /**
   * Where a reference points. A bare name is resolved against the catalog, which records which repository each
   * component belongs to; it is never qualified with the home that happens to hold the catalog. What nothing
   * answers to keeps the reference as written.
   */
  const dependency = (reference: NonNullable<Component['dependsOn']>[number]) => {
    const resolved = resolveComponentReference(reference, repositories)
    const target = resolved.component
    if (resolved.resolved) {
      return { id: catalogId(canonicalScope(resolved.repository), target, 'component', target), unresolved: false }
    }
    // An unresolved reference keeps the ID it has always had: a qualified one names its repository, and a bare
    // name stays in the home's scope. Nothing is rewritten, so a retained baseline still compares unchanged.
    const scope = resolved.repository ?? plan.manifest.id
    return { id: catalogId(scope, target, 'component', target), unresolved: true }
  }
  for (const component of plan.snapshot.components) {
    const repository = component.repo ? repositoryIdentity(component.repo) : home
    const scope = canonicalScope(repository)
    const id = (kind: CatalogKind, entity: string) => catalogId(scope, component.id, kind, entity)
    const add = (kind: CatalogKind, raw: Record<string, unknown>, description = '') => {
      const localId = String(raw.id)
      const entryId = id(kind, localId)
      // A migrated home answers to the legacy IDs that named this entry, and to the project scope it derives from
      // its repository; an unmigrated one answers to the repository-qualified form it will take, and to whatever
      // the map can already translate.
      const synthetic = catalogId(plan.manifest.id, component.id, kind, localId)
      const syntheticTarget = translateCatalogId(synthetic, legacyIds)
      const syntheticAlias = home && plan.manifest.id === identitySlug(home)
        && !legacyIds.conflicts.has(legacyScopeKey(plan.manifest.id, component.id))
        && (!syntheticTarget || syntheticTarget === entryId)
      const forms = migrated
        ? [...legacyIdForms(entryId, index), ...(syntheticAlias ? [synthetic] : [])]
        : plan.legacyIds ? catalogIdForms(entryId, legacyIds)
          : [entryId, ...(repository ? [catalogId(repository, component.id, kind, localId)] : [])]
      const aliases = [...new Set(forms)].filter(alias => alias !== entryId)
      const entry: Entity = {
        id: entryId, kind, localId, component, aliases, name: String(raw.name ?? raw.id), description, raw, related: [],
      }
      if (kind !== 'component') relate(entry, id('component', component.id), 'owner', 'Owned by component')
      entries.push(entry)
      return entry
    }
    const owner = add('component', component, component.description)
    for (const reference of component.dependsOn ?? []) {
      const target = dependency(reference)
      const reason = target.unresolved
        ? `Unresolved component dependency: no catalogued component answers to ${referenceLabel(reference)}`
        : 'Mapped component dependency; not an endpoint-level call claim'
      relate(owner, target.id, 'dependency', reason, false, target.unresolved)
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
        for (const reference of step.dependencyIds ?? []) {
          const target = dependency(reference)
          relate(entry, target.id, 'step-ref', reason, false, target.unresolved)
        }
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

/** Every entry by every ID form it answers to, so a lookup resolves a legacy and a migrated ID alike. */
export function catalogLookup(entries: Entity[]) {
  const byId = new Map<string, Entity>()
  for (const entry of entries) for (const id of [entry.id, ...entry.aliases]) if (!byId.has(id)) byId.set(id, entry)
  return byId
}

export function catalogSourceRevision(entry: Entity) {
  const evidence = (entry.raw.evidence ?? []) as NonNullable<Component['evidence']>
  const apiRevision = entry.kind === 'endpoint' || entry.kind === 'schema' ? entry.component.api?.sourceRevision : undefined
  const componentRevision = entry.component.sourceRevision ?? entry.component.scan?.revision
  return String(entry.raw.sourceRevision ?? evidence[0]?.revision ?? apiRevision ?? componentRevision ?? '') || null
}

/** The part of a catalog observation that a source-freshness check reads. */
export type SourceObservation = {
  id: string; repository: string | null; sourceRevision: string | null; raw: Record<string, unknown>
  /** The entity's other ID forms, so a freshness check resolves whichever one the caller holds. */
  aliases?: string[]
}
export function sourceObservation(entry: Entity): SourceObservation {
  return {
    id: entry.id, aliases: entry.aliases, repository: entry.component.repo ?? null,
    sourceRevision: catalogSourceRevision(entry), raw: entry.raw,
  }
}
