import { z } from 'zod'
import { catalogIndex, catalogSourceRevision } from './catalog.ts'
import { parseCatalogId } from '../src/data/catalog-identity.ts'
import { digest } from './git.ts'
import { readPlan, writePlan } from './repository.ts'

import { knowledgeBaselineSchema, baselineAssessments, discoveryAssessmentSchema, baselineHashSchema as hash } from '../src/data/knowledge.ts'
export const retainDiscoveryBaselineSchema = z.strictObject({
  featureId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
  question: z.string().min(1).max(2000), ids: z.array(z.string().min(1)).min(1).max(10),
  assumptions: z.array(z.string().min(1).max(2000)).max(20).default([]),
  expectedRevision: z.string().min(1), expectedContext: z.string().min(1),
})
export const getDiscoveryBaselineSchema = z.strictObject({ featureId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/), baselineId: hash })
export async function retainDiscoveryBaseline(root: string, input: unknown) {
  const args = retainDiscoveryBaselineSchema.parse(input)
  const plan = await readPlan(root)
  if (!plan.snapshot.features.some(feature => feature.id === args.featureId)) throw new Error('Unknown feature')
  if (plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext) throw new Error('Stale baseline; retrieve current evidence before retaining it')
  if (new Set(args.ids).size !== args.ids.length) throw new Error('Duplicate baseline entities')
  const index = catalogIndex(plan)
  const observations = args.ids.map(id => {
    parseCatalogId(id)
    const entity = index.find(entry => entry.id === id)
    if (!entity) throw new Error(`Unknown baseline entity: ${id}`)
    // A component snapshot excludes its potentially enormous child inventory. Retain specific child IDs explicitly.
    const { api: _api, data: _data, messaging: _messages, executionFlows: _flows, findings: _findings, ...component } = entity.component
    return { id, name: entity.name, repository: entity.component.repo ?? null, sourceRevision: catalogSourceRevision(entity),
      observation: entity.kind === 'component' ? component : entity.raw, relations: entity.related, componentGaps: entity.component.gaps ?? [] }
  })
  const packet = knowledgeBaselineSchema.parse({ version: 1, featureId: args.featureId, question: args.question, catalogRevision: plan.revision, context: plan.context.token, capturedAt: new Date().toISOString(), assumptions: args.assumptions, observations })
  const raw = JSON.stringify(packet, null, 2) + '\n'
  if (Buffer.byteLength(raw) > 64 * 1024) throw new Error('Baseline exceeds 64 KiB; retain fewer specific entities in separate packets')
  const baselineId = digest(raw)
  const file = `features/${args.featureId}/baselines/${baselineId}.json`
  return { ...await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes: { [file]: raw } }), baselineId, file }
}
export async function getDiscoveryBaseline(root: string, input: unknown, ref?: string) {
  const args = getDiscoveryBaselineSchema.parse(input)
  const plan = await readPlan(root, ref)
  const raw = plan.files[`features/${args.featureId}/baselines/${args.baselineId}.json`]
  if (!raw) throw new Error('Unknown discovery baseline')
  const baseline = knowledgeBaselineSchema.parse(JSON.parse(raw))
  const assessments = baselineAssessments(baseline, plan.snapshot.components, plan.manifest.id)
  const retainedChecks = Object.entries(plan.files).filter(([file]) => file.startsWith(`features/${args.featureId}/assessments/`)).map(([file, raw]) => ({ id: file.split('/')[3].replace('.json', ''), packet: discoveryAssessmentSchema.parse(JSON.parse(raw)) })).filter(item => item.packet.baselineId === args.baselineId).sort((a, b) => b.packet.checkedAt.localeCompare(a.packet.checkedAt))
  const latest = retainedChecks[0]
  return { baselineId: args.baselineId, baseline, assessments, lastSourceAssessment: latest ? { id: latest.id, checkedAt: latest.packet.checkedAt, observations: latest.packet.observations, targets: latest.packet.checks.map(check => ({ repository: check.repository, targetRevision: check.targetRevision, requestedTarget: check.requestedTarget })), note: 'Recorded check, not continuous monitoring. Recheck changed targets.' } : null, reassessmentRequired: assessments.some(item => item.catalogState !== 'unchanged') || (latest?.packet.reassessmentRequired ?? false), note: 'The retained packet is immutable. This comparison checks catalog observations only; source changes require a separate investigation.' }
}

export const assessFeatureDiscoverySchema = z.strictObject({
  featureId: z.string().min(1), baselineId: hash, expectedRevision: z.string().min(1), expectedContext: z.string().min(1),
  sources: z.array(z.strictObject({ repository: z.string().min(1).optional(), repositoryPath: z.string().min(1), targetRef: z.string().min(1), ids: z.array(z.string().min(1)).min(1).max(10) })).max(10).default([]),
})
export async function assessFeatureDiscovery(root: string, input: unknown) {
  const args = assessFeatureDiscoverySchema.parse(input), plan = await readPlan(root)
  if (plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext) throw new Error('Stale feature assessment; reread the catalog')
  const raw = plan.files[`features/${args.featureId}/baselines/${args.baselineId}.json`]
  if (!raw) throw new Error('Unknown retained baseline')
  const baseline = knowledgeBaselineSchema.parse(JSON.parse(raw))
  const observations = baselineAssessments(baseline, plan.snapshot.components, plan.manifest.id)
  const { compareCatalogSources } = await import('./catalog-freshness.ts')
  const checks: Record<string, unknown>[] = [], seen = new Set<string>()
  for (const source of args.sources) {
    const entries = source.ids.map(id => {
      const key = `${id}:${source.repository ?? 'primary'}`
      if (seen.has(key)) throw new Error('A retained observation may be checked once per repository per assessment')
      seen.add(key)
      const observation = baseline.observations.find(item => item.id === id)
      if (!observation) throw new Error('Source check IDs must belong to the retained baseline')
      const identity = parseCatalogId(id)
      const component = { id: identity.component, productId: 'retained', name: observation.name, order: 0, ...(observation.repository ? { repo: observation.repository } : {}), ...(observation.sourceRevision ? { sourceRevision: observation.sourceRevision } : {}) }
      return { id, kind: identity.kind, localId: identity.entity, component, name: observation.name, description: '', raw: { ...observation.observation, sourceRevision: observation.sourceRevision }, related: observation.relations }
    })
    const check = await compareCatalogSources(plan, { ...source, maxFiles: 20, maxBytes: 16384 }, entries)
    checks.push(check)
    const severity: Record<string, number> = { unchecked: 0, 'unchanged-source-tree': 1, 'impact-unknown': 2, unknown: 3, 'review-required': 4 }
    for (const id of source.ids) { const observation = observations.find(item => item.id === id)!; const status = check.assessments.find(item => item.id === id)?.status ?? 'unknown'; if (severity[status] > severity[observation.sourceFreshness]) observation.sourceFreshness = status }
  }
  const packet = discoveryAssessmentSchema.parse({ version: 1, featureId: args.featureId, baselineId: args.baselineId, checkedAt: new Date().toISOString(), catalogRevision: plan.revision, context: plan.context.token, observations, checks,
    reassessmentRequired: observations.some(item => item.catalogState !== 'unchanged' || !['unchecked', 'unchanged-source-tree'].includes(item.sourceFreshness)),
    note: 'Explicit check of retained facts, not a declaration of planning readiness. Unchecked sources, assumptions and deployment behavior remain unresolved. Later changes require another check.' })
  const text = JSON.stringify(packet, null, 2) + '\n'
  if (Buffer.byteLength(text) > 256 * 1024) throw new Error('Assessment exceeds 256 KiB; use fewer source groups')
  const assessmentId = digest(text)
  return { ...await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes: { [`features/${args.featureId}/assessments/${assessmentId}.json`]: text } }), assessmentId, assessment: packet }
}
