import { deliverySchema } from './delivery.ts'

type Renames = ReadonlyMap<string, string>
const renameKeys = (value: unknown, renames: Renames): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  for (const [, to] of renames) {
    if (record[to] !== undefined && !renames.has(to)) throw new Error(`Unrecognized key in legacy delivery: "${to}" mixes old and new names`)
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [renames.get(key) ?? key, item]))
}
const each = (value: unknown, renames: Renames) => Array.isArray(value) ? value.map(item => renameKeys(item, renames)) : value

const parent: Renames = new Map([['milestoneId', 'deliverableId']])
const association: Renames = new Map([['sliceId', 'taskId'], ['taskId', 'legacyTaskId']])
const validationLink: Renames = new Map([['milestoneId', 'deliverableId'], ['sliceId', 'taskId']])
// Earlier installations remain readable. Their tasks are explicitly shown as undecomposed work.
const document: Renames = new Map([['milestones', 'deliverables'], ['slices', 'tasks'], ['tasks', 'undecomposedTasks']])

/** Read old documents without assigning component ownership or inventing proof: a key-rename pass, then the current schema. */
export function parseDelivery(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return deliverySchema.parse(value)
  const record = value as Record<string, unknown>
  const old = 'milestones' in record || 'slices' in record ||
    (!('deliverables' in record) && Array.isArray(record.tasks) && record.tasks.some(t => !t || typeof t !== 'object' || !('componentId' in t)))
  if (!old) return deliverySchema.parse(value)
  const renamed = renameKeys(record, document) as Record<string, unknown>
  return deliverySchema.parse({
    ...renamed,
    tasks: each(renamed.tasks, parent),
    undecomposedTasks: each(renamed.undecomposedTasks, parent),
    validation: each(renamed.validation, validationLink),
    branches: each(renamed.branches, association),
    evidence: each(renamed.evidence, association),
  })
}
