/**
 * Pure plan mutations behind the authoring operations. Each takes the current plan and validated arguments and
 * returns the document changes for one `writePlan`; none of them touches Git or the filesystem.
 */
import path from 'node:path'
import { z } from 'zod'
import { featureSchema, featureStageSchema } from '../src/data/content-schema.ts'
import { idPattern } from '../src/data/schema-primitives.ts'
import { deliverySchema, renderBrief, type Delivery } from './format.ts'
import { Conflict, InvalidInput, NotFound } from './errors.ts'

type PlanState = { files: Record<string, string>; delivery: Record<string, Delivery> }
type Changes = Record<string, string>
const stableId = z.string().regex(idPattern)
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const featureFile = (featureId: string) => `features/${featureId}/feature.json`
const deliveryFile = (featureId: string) => `features/${featureId}/delivery.json`

export function assertCurrent(plan: { revision: string; context: { token: string } }, args: { expectedRevision: string; expectedContext: string }) {
  const stale = plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext
  if (stale) throw new Conflict('Stale edit: re-read the plan before changing it')
}
function existingFeature(plan: PlanState, featureId: string) {
  const raw = plan.files[featureFile(featureId)]
  if (!raw) throw new NotFound('Unknown feature')
  return featureSchema.parse(JSON.parse(raw))
}
const touched = (plan: PlanState, featureId: string, now: string, stage?: z.infer<typeof featureStageSchema>) => {
  const feature = existingFeature(plan, featureId)
  return json({ ...feature, ...(stage ? { stage } : {}), updatedAt: now })
}
const currentDelivery = (plan: PlanState, featureId: string): Delivery => structuredClone(plan.delivery[featureId] ?? deliverySchema.parse({}))

export const createFeatureFields = {
  id: stableId, title: z.string().min(1), productId: stableId, ownerId: stableId, problem: z.string().min(1), outcome: z.string().min(1),
}
export function createFeature(plan: PlanState, args: z.infer<z.ZodObject<typeof createFeatureFields>>, now = new Date().toISOString()): Changes {
  const file = featureFile(args.id)
  if (plan.files[file]) throw new InvalidInput('Feature ID already exists')
  const feature = featureSchema.parse({
    id: args.id, productId: args.productId, title: args.title, stage: 'idea', ownerId: args.ownerId, touches: [], updatedAt: now,
  })
  return { [file]: json(feature), [`features/${args.id}/brief.md`]: renderBrief({ problem: args.problem, outcome: args.outcome }) }
}

export const planDeliveryFields = { featureId: stableId, delivery: deliverySchema }
export function planDelivery(plan: PlanState, args: z.infer<z.ZodObject<typeof planDeliveryFields>>, now = new Date().toISOString()): Changes {
  return { [deliveryFile(args.featureId)]: json(args.delivery), [featureFile(args.featureId)]: touched(plan, args.featureId, now) }
}

export const recordProgressFields = {
  featureId: stableId, unitId: stableId.optional(), status: z.enum(['planned', 'in-progress', 'blocked', 'done']).optional(),
  stage: featureStageSchema.optional(), evidence: deliverySchema.shape.evidence.unwrap().element.optional(),
}
type RecordProgress = z.infer<z.ZodObject<typeof recordProgressFields>>
/** A unit status and its unitId come together, and a call must record something. */
export function recordProgressRules(args: Partial<RecordProgress>, ctx: z.RefinementCtx) {
  if (args.status && !args.unitId) ctx.addIssue({ code: 'custom', path: ['unitId'], message: 'A delivery status requires unitId' })
  if (args.unitId && !args.status) ctx.addIssue({ code: 'custom', path: ['status'], message: 'Supply a status with unitId' })
  if (!args.stage && !args.unitId && !args.evidence) ctx.addIssue({ code: 'custom', path: [], message: 'Supply stage, a unit status, or evidence' })
}
export function recordProgress(plan: PlanState, args: RecordProgress, now = new Date().toISOString()): Changes {
  const feature = touched(plan, args.featureId, now, args.stage)
  const delivery = currentDelivery(plan, args.featureId)
  if (args.unitId && args.status) {
    const unit = [...delivery.tasks, ...delivery.undecomposedTasks, ...delivery.deliverables].find(item => item.id === args.unitId)
    if (!unit) throw new NotFound(`Unknown delivery unit: ${args.unitId}`)
    unit.status = args.status
  }
  if (args.evidence) delivery.evidence.push(args.evidence)
  return { [featureFile(args.featureId)]: feature, [deliveryFile(args.featureId)]: json(delivery) }
}

export const linkBranchFields = { featureId: stableId, legacyTaskId: stableId.optional(), taskId: stableId.optional(), branch: z.string().min(1) }
type LinkBranch = z.infer<z.ZodObject<typeof linkBranchFields>>
export function linkBranch(plan: PlanState, args: LinkBranch, localBranches: string[], now = new Date().toISOString()): Changes {
  const feature = touched(plan, args.featureId, now)
  if (!localBranches.includes(args.branch)) throw new InvalidInput('Branch must exist locally; fetch explicitly before linking a remote branch')
  const delivery = currentDelivery(plan, args.featureId)
  const link = { branch: args.branch, ...(args.legacyTaskId ? { legacyTaskId: args.legacyTaskId } : {}), ...(args.taskId ? { taskId: args.taskId } : {}) }
  const linked = delivery.branches.some(item => item.branch === link.branch && item.legacyTaskId === link.legacyTaskId && item.taskId === link.taskId)
  if (!linked) delivery.branches.push(link)
  return { [featureFile(args.featureId)]: feature, [deliveryFile(args.featureId)]: json(delivery) }
}

export const createWorktreeFields = { branch: z.string().min(1), path: z.string().min(1), startRef: z.string().min(1) }
export function createWorktreeRules(args: Partial<z.infer<z.ZodObject<typeof createWorktreeFields>>>, ctx: z.RefinementCtx) {
  if (args.path !== undefined && !path.isAbsolute(args.path)) ctx.addIssue({ code: 'custom', path: ['path'], message: 'Worktree path must be absolute' })
  for (const key of ['branch', 'startRef'] as const) {
    if (args[key]?.startsWith('-')) ctx.addIssue({ code: 'custom', path: [key], message: 'Invalid Git reference' })
  }
}
