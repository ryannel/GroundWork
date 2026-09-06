import { z } from 'zod'
import type { ContentSnapshot } from './content.ts'
import { componentScopeIds } from './component-structure.ts'
const id = z.string().regex(/^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
const text = z.string().trim().min(1)
const ids = z.array(id).default([])
export const deliveryStatusSchema = z.enum(['planned', 'in-progress', 'blocked', 'done'])
const unit = z.strictObject({ id, title: text, status: deliveryStatusSchema, dependsOn: ids, acceptance: z.array(text).default([]) })
export const deliverableSchema = unit.extend({ outcome: text.optional(), componentIds: ids })
export const taskSchema = unit.extend({ deliverableId: id, componentId: id, scope: z.array(text).default([]), prerequisites: z.array(text).default([]), contractIds: ids })
const validation = z.strictObject({ id, title: text, testIds: ids, file: text.optional(), command: text.optional(), entryPoint: text.optional(), environment: text.optional(), realDependencyIds: ids, substitutedDependencyIds: ids, notes: text.optional() })
export const validationSchema = z.discriminatedUnion('level', [
  validation.extend({ level: z.literal('end-to-end'), deliverableId: id }),
  validation.extend({ level: z.literal('component-integration'), taskId: id }),
  validation.extend({ level: z.literal('unit'), taskId: id }),
])
export const deliveryEvidenceSchema = z.strictObject({ id, legacyTaskId: id.optional(), taskId: id.optional(), validationId: id.optional(), description: text, result: z.enum(['unverified', 'passed', 'failed']), recordedAt: z.iso.datetime({ offset: true }), reference: text.optional(), testedRevision: text.optional(), environment: text.optional() })
export const branchLinkSchema = z.strictObject({ branch: text, legacyTaskId: id.optional(), taskId: id.optional() })
export const deliverySchema = z.strictObject({
  deliverables: z.array(deliverableSchema).default([]),
  tasks: z.array(taskSchema).default([]),
  validation: z.array(validationSchema).default([]),
  // Earlier work without component ownership remains separate from delivery tasks.
  undecomposedTasks: z.array(unit.extend({ deliverableId: id.optional() })).default([]),
  branches: z.array(branchLinkSchema).default([]),
  evidence: z.array(deliveryEvidenceSchema).default([]),
})
export type Delivery = z.infer<typeof deliverySchema>
export type Deliverable = z.infer<typeof deliverableSchema>
export type Task = z.infer<typeof taskSchema>
export type Validation = z.infer<typeof validationSchema>

export function validateDelivery(featureId: string, plan: Delivery, snapshot: ContentSnapshot) {
  const fail = (message: string): never => { throw new Error(`delivery/${featureId}: ${message}`) }
  const feature = snapshot.features.find(f => f.id === featureId)
  if (!feature) fail('missing feature')
  const units = [...plan.deliverables, ...plan.tasks, ...plan.undecomposedTasks]
  const byId = new Map(units.map(unit => [unit.id, unit]))
  const deliverables = new Map(plan.deliverables.map(m => [m.id, m]))
  const tasks = new Map(plan.tasks.map(s => [s.id, s]))
  if (byId.size !== units.length) fail('duplicate unit ID')
  const visited = new Set<string>()
  const visit = (unitId: string, stack: string[]) => {
    if (stack.includes(unitId)) fail(`dependency cycle at ${unitId}`)
    if (visited.has(unitId)) return
    const unit = byId.get(unitId)
    if (!unit) fail(`unknown dependency ${unitId}`)
    for (const dependency of unit!.dependsOn) visit(dependency, [...stack, unitId])
    visited.add(unitId)
  }
  for (const unit of units) visit(unit.id, [])
  const unique = (values: string[], description: string) => { if (new Set(values).size !== values.length) fail(`duplicate ${description}`) }
  const workspaceId = snapshot.products.find(p => p.id === feature!.productId)?.workspaceId
  const component = (componentId: string) => {
    const match = snapshot.components.find(c => c.id === componentId)
    if (!match || snapshot.products.find(p => p.id === match.productId)?.workspaceId !== workspaceId) fail(`unknown component ${componentId}`)
  }
  for (const deliverable of plan.deliverables) {
    unique(deliverable.componentIds, `component in ${deliverable.id}`)
    deliverable.componentIds.forEach(component)
    for (const dependency of deliverable.dependsOn) if (!deliverables.has(dependency)) fail(`${deliverable.id}: deliverables depend on deliverables; their own tasks are implicit completion requirements`)
  }
  for (const task of plan.tasks) {
    const parent = deliverables.get(task.deliverableId)
    if (!parent) fail(`unknown deliverable ${task.deliverableId}`)
    component(task.componentId)
    if (!parent!.componentIds.some(id => componentScopeIds(id, snapshot.components).has(task.componentId))) fail(`${task.id}: owned component must be in its deliverable's component chain`)
    const owned = componentScopeIds(task.componentId, snapshot.components)
    unique(task.contractIds, `contract in ${task.id}`)
    for (const contractId of task.contractIds) {
      const contract = feature!.spec?.api?.contracts.find(c => c.id === contractId)
      if (!contract || (!owned.has(contract.from) && !owned.has(contract.to))) fail(`${task.id}: contract ${contractId} must touch its component boundary`)
    }
    for (const dependency of task.dependsOn) if (dependency === task.deliverableId) fail(`${task.id}: a task cannot depend on its own deliverable`)
  }
  // Include containment in scheduling cycles: a deliverable waits for its tasks.
  const scheduling = (unitId: string, stack: string[], complete: Set<string>) => {
    if (stack.includes(unitId)) fail(`delivery scheduling cycle at ${unitId}`)
    if (complete.has(unitId)) return
    const unit = byId.get(unitId)!
    const edges = [...unit.dependsOn, ...plan.tasks.filter(s => s.deliverableId === unitId).map(s => s.id)]
    for (const target of edges) scheduling(target, [...stack, unitId], complete)
    complete.add(unitId)
  }
  const complete = new Set<string>()
  for (const unit of units) scheduling(unit.id, [], complete)
  for (const task of plan.undecomposedTasks) if (task.deliverableId && !deliverables.has(task.deliverableId)) fail(`unknown deliverable ${task.deliverableId}`)
  unique(plan.validation.map(v => v.id), 'validation ID')
  for (const check of plan.validation) {
    if (check.level === 'end-to-end') { if (!deliverables.has(check.deliverableId)) fail(`unknown validation deliverable ${check.deliverableId}`) }
    else if (!tasks.has(check.taskId)) fail(`unknown validation task ${check.taskId}`)
    unique(check.testIds, `test in ${check.id}`)
    for (const testId of check.testIds) if (!feature!.spec?.tests?.cases.some(t => t.id === testId)) fail(`${check.id}: unknown test ${testId}`)
    ;[...check.realDependencyIds, ...check.substitutedDependencyIds].forEach(component)
    if (check.realDependencyIds.some(id => check.substitutedDependencyIds.includes(id))) fail(`${check.id}: a dependency cannot be both real and substituted`)
    if (check.level !== 'end-to-end' && check.substitutedDependencyIds.includes(tasks.get(check.taskId)!.componentId)) fail(`${check.id}: cannot substitute the component under test`)
  }
  for (const record of [...plan.branches, ...plan.evidence]) {
    if (record.legacyTaskId && !plan.undecomposedTasks.some(t => t.id === record.legacyTaskId)) fail(`unknown undecomposed task ${record.legacyTaskId}`)
    if (record.taskId && !tasks.has(record.taskId)) fail(`unknown task ${record.taskId}`)
    if (record.legacyTaskId && record.taskId) fail('choose one task or undecomposed task association')
  }
  for (const evidence of plan.evidence) {
    const check = plan.validation.find(v => v.id === evidence.validationId)
    if (evidence.validationId && !check) fail(`unknown evidence validation ${evidence.validationId}`)
    if (evidence.taskId && check && (check.level === 'end-to-end' || check.taskId !== evidence.taskId)) fail(`${evidence.id}: evidence must belong to its validation's task`)
  }
  unique(plan.evidence.map(e => e.id), 'evidence ID')
}

/** Report gaps without converting declared progress or old source checkboxes into proof. */
export function validationResult(plan: Delivery, check: Validation) {
  const records = plan.evidence.filter(e => e.validationId === check.id).sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
  const latestTime = records[0]?.recordedAt
  const latest = records.filter(e => Date.parse(e.recordedAt) === Date.parse(latestTime ?? ''))
  const evidence = latest.find(e => e.result === 'failed') ?? latest.find(e => e.result === 'unverified') ?? latest[0]
  return { evidence, result: evidence?.result ?? 'unverified' }
}
export function deliveryGaps(plan: Delivery, unit: Deliverable | Task): string[] {
  const task = 'componentId' in unit
  const checks = plan.validation.filter(v => task ? v.level === 'component-integration' && v.taskId === unit.id : v.level === 'end-to-end' && v.deliverableId === unit.id)
  const gaps: string[] = []
  if (!task && !unit.outcome) gaps.push('Describe the user-visible outcome')
  if (!task && !unit.componentIds.length) gaps.push('Name the components in the delivery chain')
  if (task && !unit.scope.length) gaps.push('Define the component work')
  if (task && !unit.contractIds.length) gaps.push('Link the public API or event contracts')
  if (!unit.acceptance.length) gaps.push('Define acceptance criteria')
  if (!checks.length) gaps.push(task ? 'Plan component integration tests' : 'Plan end-to-end tests')
  for (const check of checks) {
    if (!check.testIds.length) gaps.push(`${check.title}: link observable test scenarios`)
    if (!check.command || !check.file) gaps.push(`${check.title}: name the test file and command`)
    if (!check.entryPoint || !check.environment) gaps.push(`${check.title}: describe the entry point and test environment`)
    const recorded = validationResult(plan, check).evidence
    if (recorded?.result === 'passed' && (!recorded.testedRevision || !recorded.environment || !recorded.reference)) gaps.push(`${check.title}: record the tested revision, environment, and result reference`)
    if (validationResult(plan, check).result !== 'passed') gaps.push(`${check.title}: no latest passing run recorded`)
  }
  if (!task) {
    const children = plan.tasks.filter(s => s.deliverableId === unit.id)
    if (!children.length) gaps.push('Divide the deliverable into component tasks')
    for (const child of children) if (child.status !== 'done' || deliveryGaps(plan, child).length) gaps.push(`${child.title}: task not complete with validation`)
  }
  const units = [...plan.deliverables, ...plan.tasks, ...plan.undecomposedTasks]
  for (const dependency of unit.dependsOn) {
    const target = units.find(u => u.id === dependency)
    const plannedTarget = [...plan.deliverables, ...plan.tasks].find(u => u.id === dependency)
    if (!target || target.status !== 'done' || (plannedTarget && deliveryGaps(plan, plannedTarget).length)) gaps.push(`Dependency ${dependency} is not complete with validation`)
  }
  return gaps
}
