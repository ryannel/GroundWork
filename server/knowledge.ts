import { z } from 'zod'
import { catalogIndex } from './catalog.ts'
import { compareCatalogSources, worstStatus, type FreshnessStatus } from './catalog-freshness.ts'
import { parseCatalogId } from '../src/data/catalog-identity.ts'
import { idPattern } from '../src/data/schema-primitives.ts'
import type { SourceObservation } from '../src/data/catalog-index.ts'
import { digest } from './git.ts'
import { readPlan, writePlan } from './repository.ts'
import { Conflict, InvalidInput, NotFound } from './errors.ts'
import {
  knowledgeBaselineSchema, baselineAssessments, discoveryAssessmentSchema, entityObservation, baselineHashSchema as hash,
} from '../src/data/knowledge.ts'

type Plan = Awaited<ReturnType<typeof readPlan>>
const featureId = z.string().regex(idPattern)
export const retainDiscoveryBaselineSchema = z.strictObject({
  featureId,
  question: z.string().min(1).max(2000), ids: z.array(z.string().min(1)).min(1).max(10),
  assumptions: z.array(z.string().min(1).max(2000)).max(20).default([]),
  expectedRevision: z.string().min(1), expectedContext: z.string().min(1),
})
export const getDiscoveryBaselineSchema = z.strictObject({ featureId, baselineId: hash })
export const assessFeatureDiscoverySchema = z.strictObject({
  featureId: z.string().min(1), baselineId: hash, expectedRevision: z.string().min(1), expectedContext: z.string().min(1),
  sources: z.array(z.strictObject({
    repository: z.string().min(1).optional(), repositoryPath: z.string().min(1), targetRef: z.string().min(1),
    ids: z.array(z.string().min(1)).min(1).max(10),
  })).max(10).default([]),
})

function assertCurrent(plan: Plan, args: { expectedRevision: string; expectedContext: string }, message: string) {
  if (plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext) throw new Conflict(message)
}
function retainedBaseline(plan: Plan, featureId: string, baselineId: string) {
  const raw = plan.files[`features/${featureId}/baselines/${baselineId}.json`]
  if (!raw) throw new NotFound('Unknown discovery baseline')
  return knowledgeBaselineSchema.parse(JSON.parse(raw))
}

export async function retainDiscoveryBaseline(root: string, input: z.input<typeof retainDiscoveryBaselineSchema>) {
  const args = retainDiscoveryBaselineSchema.parse(input)
  const plan = await readPlan(root)
  if (!plan.snapshot.features.some(feature => feature.id === args.featureId)) throw new NotFound('Unknown feature')
  assertCurrent(plan, args, 'Stale baseline; retrieve current evidence before retaining it')
  if (new Set(args.ids).size !== args.ids.length) throw new InvalidInput('Duplicate baseline entities')
  const index = new Map(catalogIndex(plan).map(entry => [entry.id, entry]))
  const observations = args.ids.map(id => {
    parseCatalogId(id)
    const entry = index.get(id)
    if (!entry) throw new NotFound(`Unknown baseline entity: ${id}`)
    return entityObservation(entry)
  })
  const packet = knowledgeBaselineSchema.parse({
    version: 1, featureId: args.featureId, question: args.question, catalogRevision: plan.revision, context: plan.context.token,
    capturedAt: new Date().toISOString(), assumptions: args.assumptions, observations,
  })
  const raw = JSON.stringify(packet, null, 2) + '\n'
  if (Buffer.byteLength(raw) > 64 * 1024) throw new InvalidInput('Baseline exceeds 64 KiB; retain fewer specific entities in separate packets')
  const baselineId = digest(raw)
  const file = `features/${args.featureId}/baselines/${baselineId}.json`
  const written = await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes: { [file]: raw } })
  return { ...written, baselineId, file }
}

export async function getDiscoveryBaseline(root: string, input: z.input<typeof getDiscoveryBaselineSchema>, ref?: string) {
  const args = getDiscoveryBaselineSchema.parse(input)
  const plan = await readPlan(root, ref)
  const baseline = retainedBaseline(plan, args.featureId, args.baselineId)
  const assessments = baselineAssessments(baseline, plan.snapshot.components, plan.manifest.id)
  const prefix = `features/${args.featureId}/assessments/`
  const retainedChecks = Object.entries(plan.files)
    .filter(([file]) => file.startsWith(prefix))
    .map(([file, raw]) => ({ id: file.slice(prefix.length).replace(/\.json$/, ''), packet: discoveryAssessmentSchema.parse(JSON.parse(raw)) }))
    .filter(item => item.packet.baselineId === args.baselineId)
    .sort((a, b) => b.packet.checkedAt.localeCompare(a.packet.checkedAt))
  const latest = retainedChecks[0]
  const lastSourceAssessment = latest ? {
    id: latest.id, checkedAt: latest.packet.checkedAt, observations: latest.packet.observations,
    targets: latest.packet.checks.map(({ repository, targetRevision, requestedTarget }) => ({ repository, targetRevision, requestedTarget })),
    note: 'Recorded check, not continuous monitoring. Recheck changed targets.',
  } : null
  const reassessmentRequired = assessments.some(item => item.catalogState !== 'unchanged') || (latest?.packet.reassessmentRequired ?? false)
  return {
    baselineId: args.baselineId, baseline, assessments, lastSourceAssessment, reassessmentRequired,
    note: 'The retained packet is immutable. This comparison checks catalog observations only; source changes require a separate investigation.',
  }
}

export async function assessFeatureDiscovery(root: string, input: z.input<typeof assessFeatureDiscoverySchema>) {
  const args = assessFeatureDiscoverySchema.parse(input), plan = await readPlan(root)
  assertCurrent(plan, args, 'Stale feature assessment; reread the catalog')
  const baseline = retainedBaseline(plan, args.featureId, args.baselineId)
  const observations = baselineAssessments(baseline, plan.snapshot.components, plan.manifest.id)
  const checks: Record<string, unknown>[] = [], seen = new Set<string>()
  for (const source of args.sources) {
    // Source checks read the retained observation, not the current catalog, so later catalog edits cannot hide a change.
    const retained: SourceObservation[] = source.ids.map(id => {
      const key = `${id}:${source.repository ?? 'primary'}`
      if (seen.has(key)) throw new InvalidInput('A retained observation may be checked once per repository per assessment')
      seen.add(key)
      const observation = baseline.observations.find(item => item.id === id)
      if (!observation) throw new InvalidInput('Source check IDs must belong to the retained baseline')
      return { id, repository: observation.repository, sourceRevision: observation.sourceRevision, raw: observation.observation }
    })
    const check = await compareCatalogSources(plan, { ...source, maxFiles: 20, maxBytes: 16384 }, retained)
    checks.push(check)
    for (const id of source.ids) {
      const observation = observations.find(item => item.id === id)!
      // An observation keeps the most severe status any check reported.
      const status: FreshnessStatus = check.assessments.find(item => item.id === id)?.status ?? 'unknown'
      observation.sourceFreshness = worstStatus([observation.sourceFreshness as FreshnessStatus, status], 'unchecked')
    }
  }
  const reusable = ['unchecked', 'unchanged-source-tree']
  const packet = discoveryAssessmentSchema.parse({
    version: 1, featureId: args.featureId, baselineId: args.baselineId, checkedAt: new Date().toISOString(),
    catalogRevision: plan.revision, context: plan.context.token, observations, checks,
    reassessmentRequired: observations.some(item => item.catalogState !== 'unchanged' || !reusable.includes(item.sourceFreshness)),
    note: 'Explicit check of retained facts, not a declaration of planning readiness. '
      + 'Unchecked sources, assumptions and deployment behavior remain unresolved. Later changes require another check.',
  })
  const text = JSON.stringify(packet, null, 2) + '\n'
  if (Buffer.byteLength(text) > 256 * 1024) throw new InvalidInput('Assessment exceeds 256 KiB; use fewer source groups')
  const assessmentId = digest(text)
  const file = `features/${args.featureId}/assessments/${assessmentId}.json`
  const written = await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes: { [file]: text } })
  return { ...written, assessmentId, assessment: packet }
}
