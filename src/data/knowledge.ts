import { catalogIndex, catalogSourceRevision, relationKinds, type Entity } from './catalog-index.ts'
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
    relations: z.array(z.strictObject({ id: z.string(), reason: z.string(), kind: z.enum(relationKinds).optional(), reverse: z.boolean().optional() })),
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
const relationKeys = (relations: { id: string; kind?: string; reverse?: boolean }[]) =>
  canonical(relations.map(relation => [relation.id, relation.kind ?? null, relation.reverse ?? null]).sort((a, b) => canonical(a).localeCompare(canonical(b))))

export function baselineAssessments(baseline: z.infer<typeof knowledgeBaselineSchema>, components: Component[], projectId: string) {
  const index = new Map(catalogIndex({ manifest: { id: projectId }, snapshot: { components } }).map(entry => [entry.id, entry]))
  return baseline.observations.map(retained => {
    const entry = index.get(retained.id)
    const current = entry && entityObservation(entry)
    const unchanged = !!current
      && canonical(current.observation) === canonical(retained.observation)
      && relationKeys(current.relations) === relationKeys(retained.relations)
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
