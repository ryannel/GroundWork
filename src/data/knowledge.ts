import { catalogIndex, catalogSourceRevision } from './catalog-index.ts'
import type { Component } from './model.ts'
import { z } from 'zod'
export const baselineHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const knowledgeBaselineSchema = z.strictObject({
  version: z.literal(1), featureId: z.string().min(1), question: z.string().min(1).max(2000),
  catalogRevision: baselineHashSchema, context: baselineHashSchema, capturedAt: z.iso.datetime(),
  assumptions: z.array(z.string().min(1).max(2000)).max(20),
  observations: z.array(z.strictObject({
    id: z.string().min(1), name: z.string(), repository: z.string().nullable(),
    sourceRevision: z.string().nullable(), observation: z.record(z.string(), z.unknown()),
    relations: z.array(z.strictObject({ id: z.string(), reason: z.string() })),
    componentGaps: z.array(z.strictObject({ area: z.string(), reason: z.string() })),
  })).min(1).max(10),
})

export function baselineAssessments(baseline: z.infer<typeof knowledgeBaselineSchema>, components: Component[], projectId: string) {
  const index = catalogIndex({ manifest: { id: projectId }, snapshot: { components } })
  return baseline.observations.map(observation => {
    const current = index.find(entry => entry.id === observation.id)
    let raw = current?.raw
    if (current?.kind === 'component') { const { api: _api, data: _data, messaging: _messages, executionFlows: _flows, findings: _findings, ...rest } = current.component; raw = rest }
    return { id: observation.id, catalogState: !current ? 'removed' : JSON.stringify(raw) === JSON.stringify(observation.observation) && JSON.stringify(current.related) === JSON.stringify(observation.relations) && JSON.stringify(current.component.gaps ?? []) === JSON.stringify(observation.componentGaps) && (current.component.repo ?? null) === observation.repository && catalogSourceRevision(current) === observation.sourceRevision ? 'unchanged' : 'changed', sourceFreshness: 'unchecked' }
  })
}
export const discoveryAssessmentSchema = z.strictObject({
  version: z.literal(1), featureId: z.string(), baselineId: baselineHashSchema, checkedAt: z.iso.datetime(),
  catalogRevision: baselineHashSchema, context: baselineHashSchema,
  observations: z.array(z.strictObject({ id: z.string(), catalogState: z.enum(['unchanged', 'changed', 'removed']), sourceFreshness: z.string() })),
  checks: z.array(z.record(z.string(), z.unknown())).max(10), reassessmentRequired: z.boolean(),
  note: z.string(),
})
