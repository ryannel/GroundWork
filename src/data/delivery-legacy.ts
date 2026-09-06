import { z } from 'zod'
import { deliverySchema } from './delivery.ts'
const id = z.string().regex(/^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
const text = z.string().trim().min(1)
const ids = z.array(id).default([])
const deliveryStatusSchema = z.enum(['planned', 'in-progress', 'blocked', 'done'])
const unit = z.strictObject({ id, title: text, status: deliveryStatusSchema, dependsOn: ids, acceptance: z.array(text).default([]) })
const milestoneSchema = unit.extend({ outcome: text.optional(), componentIds: ids })
const sliceSchema = unit.extend({ milestoneId: id, componentId: id, scope: z.array(text).default([]), prerequisites: z.array(text).default([]), contractIds: ids })
const validation = z.strictObject({ id, title: text, testIds: ids, file: text.optional(), command: text.optional(), entryPoint: text.optional(), environment: text.optional(), realDependencyIds: ids, substitutedDependencyIds: ids, notes: text.optional() })
const validationSchema = z.discriminatedUnion('level', [
  validation.extend({ level: z.literal('end-to-end'), milestoneId: id }),
  validation.extend({ level: z.literal('component-integration'), sliceId: id }),
  validation.extend({ level: z.literal('unit'), sliceId: id }),
])
const deliveryEvidenceSchema = z.strictObject({ id, taskId: id.optional(), sliceId: id.optional(), validationId: id.optional(), description: text, result: z.enum(['unverified', 'passed', 'failed']), recordedAt: z.iso.datetime({ offset: true }), reference: text.optional(), testedRevision: text.optional(), environment: text.optional() })
const branchLinkSchema = z.strictObject({ branch: text, taskId: id.optional(), sliceId: id.optional() })
const legacyDeliverySchema = z.strictObject({
  milestones: z.array(milestoneSchema).default([]),
  slices: z.array(sliceSchema).default([]),
  validation: z.array(validationSchema).default([]),
  // Earlier installations remain readable. Tasks are explicitly shown as undecomposed work.
  tasks: z.array(unit.extend({ milestoneId: id.optional() })).default([]),
  branches: z.array(branchLinkSchema).default([]),
  evidence: z.array(deliveryEvidenceSchema).default([]),
})

/** Read old documents without assigning component ownership or inventing proof. */
export function parseDelivery(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return deliverySchema.parse(value)
  const record = value as Record<string, unknown>
  const old = 'milestones' in record || 'slices' in record ||
    (!('deliverables' in record) && Array.isArray(record.tasks) && record.tasks.some(t => !t || typeof t !== 'object' || !('componentId' in t)))
  if (!old) return deliverySchema.parse(value)
  const plan = legacyDeliverySchema.parse(value)
  const parent = <T extends { milestoneId?: string }>({ milestoneId, ...rest }: T) => ({ ...rest, ...(milestoneId ? { deliverableId: milestoneId } : {}) })
  const association = <T extends { sliceId?: string; taskId?: string }>({ sliceId, taskId, ...rest }: T) => ({ ...rest, ...(sliceId ? { taskId: sliceId } : {}), ...(taskId ? { legacyTaskId: taskId } : {}) })
  return deliverySchema.parse({
    deliverables: plan.milestones,
    tasks: plan.slices.map(parent),
    undecomposedTasks: plan.tasks.map(parent),
    validation: plan.validation.map(v => v.level === 'end-to-end' ? parent(v) : association(v)),
    branches: plan.branches.map(association),
    evidence: plan.evidence.map(association),
  })
}
