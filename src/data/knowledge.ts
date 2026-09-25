import {
  catalogIndex, catalogLookup, catalogSourceRevision, indexedScope, relationKinds, type CatalogScope, type Entity,
} from './catalog-index.ts'
import { componentRepositories, referenceKey } from './component-reference.ts'
import { parseCatalogId } from './catalog-identity.ts'
import type { Component } from './model.ts'
import { z } from 'zod'
import { isoTimestamp } from './schema-primitives.ts'
export const baselineHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const knowledgeBaselineSchema = z.strictObject({
  version: z.literal(1), featureId: z.string().min(1), question: z.string().min(1).max(2000),
  catalogRevision: baselineHashSchema, context: baselineHashSchema, capturedAt: isoTimestamp,
  assumptions: z.array(z.string().min(1).max(2000)).max(20),
  observations: z.array(z.strictObject({
    id: z.string().min(1), name: z.string(), repository: z.string().nullable(),
    sourceRevision: z.string().nullable(), observation: z.record(z.string(), z.unknown()),
    // kind/reverse are absent in baselines retained before relations were typed; those compare as changed.
    relations: z.array(z.strictObject({
      id: z.string(), reason: z.string(), kind: z.enum(relationKinds).optional(), reverse: z.boolean().optional(),
      // Retained as written when no catalogued component answered to the reference; it never counts as a change.
      unresolved: z.boolean().optional(),
    })),
    componentGaps: z.array(z.strictObject({ area: z.string(), reason: z.string() })),
  })).min(1).max(10),
})
type RetainedObservation = z.infer<typeof knowledgeBaselineSchema>['observations'][number]

/** A component observation excludes its potentially enormous child inventory; child entities are retained by ID. */
export function componentObservation(component: Component): Record<string, unknown> {
  const { api: _api, data: _data, messaging: _messaging, executionFlows: _flows, findings: _findings, jobs: _jobs, ...rest } = component
  return rest
}
/** The retained form of one catalog entry. Baselines store it and later comparisons recompute it. */
export function entityObservation(entry: Entity): RetainedObservation {
  return {
    id: entry.id, name: entry.name, repository: entry.component.repo ?? null, sourceRevision: catalogSourceRevision(entry),
    observation: entry.kind === 'component' ? componentObservation(entry.component) : entry.raw,
    relations: entry.related, componentGaps: entry.component.gaps ?? [],
  }
}

/** Key order never counts as a change. */
const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  : item)
/** Relations compare by target, kind and direction; display text and order do not count. */
const relationKeys = (relations: { id: string; kind?: string; reverse?: boolean }[], lookup: ReturnType<typeof catalogLookup>) =>
  canonical(relations.map(relation => {
    let id = lookup.get(relation.id)?.id ?? relation.id
    if (!lookup.has(relation.id)) {
      // A bare unresolved name was scoped to the old project ID and later to the synthetic v3 ID. Neither has a
      // catalog entry to alias, so compare its bare name while retaining a structured repository's distinct scope.
      try {
        const parsed = parseCatalogId(id)
        if (!parsed.scope.includes('/') && !parsed.scope.startsWith('local:')) id = `?/${parsed.component}/${parsed.kind}/${parsed.entity}`
      } catch { /* An unresolved non-catalog reference keeps its exact spelling. */ }
    }
    return [id, relation.kind ?? null, relation.reverse ?? null]
  })
    .sort((a, b) => canonical(a).localeCompare(canonical(b))))
/** Only the two fields that can change representation during migration are compared by resolved reference. */
function comparableObservation(observation: Record<string, unknown>, kind: Entity['kind'], repositories: Map<string, string | undefined>) {
  const reference = (value: unknown) => {
    if (typeof value === 'string') return referenceKey(value, repositories)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const item = value as Record<string, unknown>
      if (typeof item.repository === 'string' && typeof item.component === 'string') {
        return referenceKey({ repository: item.repository, component: item.component }, repositories)
      }
    }
    return value
  }
  if (kind === 'component' && Array.isArray(observation.dependsOn)) {
    return { ...observation, dependsOn: observation.dependsOn.map(reference) }
  }
  if (kind === 'flow' && Array.isArray(observation.steps)) {
    return { ...observation, steps: observation.steps.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value
      const step = value as Record<string, unknown>
      return Array.isArray(step.dependencyIds) ? { ...step, dependencyIds: step.dependencyIds.map(reference) } : step
    }) }
  }
  return observation
}

/** Which catalog a baseline is compared against: a bare legacy project ID, a plan, or a plan's identity projection. */
export type BaselineScope = CatalogScope
/**
 * Compares a retained baseline against the current catalog. Retained IDs are looked up in every form a catalog
 * entry answers to, so a baseline captured before the migration still finds its entry afterwards.
 */
export function baselineAssessments(baseline: z.infer<typeof knowledgeBaselineSchema>, components: Component[], scope: BaselineScope) {
  const index = catalogLookup(catalogIndex({ ...indexedScope(scope), snapshot: { components } }))
  const identity = indexedScope(scope)
  const repositories = componentRepositories(components, identity.repository?.id)
  return baseline.observations.map(retained => {
    const entry = index.get(retained.id)
    const current = entry && entityObservation(entry)
    const unchanged = !!current
      && canonical(comparableObservation(current.observation, entry.kind, repositories))
        === canonical(comparableObservation(retained.observation, entry.kind, repositories))
      && relationKeys(current.relations, index) === relationKeys(retained.relations, index)
      && canonical(current.componentGaps) === canonical(retained.componentGaps)
      && current.repository === retained.repository
      && current.sourceRevision === retained.sourceRevision
    return { id: retained.id, catalogState: !current ? 'removed' : unchanged ? 'unchanged' : 'changed', sourceFreshness: 'unchecked' }
  })
}
export const discoveryAssessmentSchema = z.strictObject({
  version: z.literal(1), featureId: z.string(), baselineId: baselineHashSchema, checkedAt: isoTimestamp,
  catalogRevision: baselineHashSchema, context: baselineHashSchema,
  observations: z.array(z.strictObject({ id: z.string(), catalogState: z.enum(['unchanged', 'changed', 'removed']), sourceFreshness: z.string() })),
  checks: z.array(z.record(z.string(), z.unknown())).max(10), reassessmentRequired: z.boolean(),
  note: z.string(),
})
