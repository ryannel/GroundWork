import { z } from 'zod'

// This is the source of truth for runtime validation, TypeScript types and JSON Schema.
const text = z.string().min(1).regex(/\S/, 'Text cannot be blank')
const id = text.regex(/^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Use a URL-safe stable ID')
const slug = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const ids = z.array(id)
const order = z.number().int().nonnegative().optional()
const strings = z.array(text)
export const productKindSchema = z.enum(['service-system', 'desktop-app', 'cli', 'playground', 'library'])
export const featureStageSchema = z.enum(['idea', 'exploring', 'designing', 'specced', 'building', 'shipped'])
export const changeSchema = z.enum(['added', 'updated', 'removed', 'unchanged', 'unspecified'])
export const testStatusSchema = z.enum(['planned', 'written', 'passing', 'failing'])
export const criterionSchema = z.strictObject({ id, text, tests: ids.optional() })
export const purposeSchema = z.strictObject({ problem: text, outcome: text, nonGoals: strings.optional(), success: z.array(criterionSchema).optional() })
export const journeyStepSchema = z.strictObject({
  id, actor: text, action: text, surface: text.optional(), note: text.optional(), branch: text.optional(),
  design: id.optional(), flow: ids.optional(), flowEdges: ids.optional(), result: text.optional(), contracts: ids.optional(),
})
export const journeySchema = z.strictObject({ steps: z.array(journeyStepSchema) })
export const mockupSchema = z.strictObject({ id, kind: z.enum(['live', 'wireframe', 'figma', 'image']), title: text, ref: text, note: text.optional() })
export const designSchema = z.strictObject({ mockups: z.array(mockupSchema) })
export const flowNodeSchema = z.strictObject({
  id, label: text, kind: z.enum(['process', 'decision', 'worker', 'store', 'external', 'queue']), component: id.optional(),
  col: z.number().int().nonnegative(), row: z.number().int().nonnegative(), tables: ids.optional(), description: text.optional(),
  logic: z.strictObject({ expression: text, explanation: text.optional(), branches: z.array(z.strictObject({ edgeId: id, when: text, then: text })) }).optional(),
})
export const flowEdgeSchema = z.strictObject({ id, from: id, to: id, label: text.optional(), async: z.boolean().optional(), contracts: ids.optional() })
export const flowSchema = z.strictObject({ nodes: z.array(flowNodeSchema), edges: z.array(flowEdgeSchema) })
export const schemaFieldSchema = z.strictObject({
  name: text, type: text, optional: z.boolean().optional(), note: text.optional(),
  get fields(): z.ZodOptional<z.ZodArray<typeof schemaFieldSchema>> { return z.array(schemaFieldSchema).optional() },
})
export const responseSchema = z.strictObject({ before: z.array(schemaFieldSchema).optional(), after: z.array(schemaFieldSchema).optional() })
export const apiContractSchema = z.strictObject({
  id, name: text, change: changeSchema, changes: strings.optional(), from: id, to: id,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'EVENT', 'RPC']).optional(), path: text,
  request: text.optional(), response: text.optional(), responseSchema: responseSchema.optional(), note: text.optional(),
})
export const apiGuideSchema = z.strictObject({
  componentId: id, overview: text, featureImpact: text,
  capabilities: z.array(z.strictObject({ id, title: text, description: text, contractIds: ids })),
})
export const apiSchema = z.strictObject({ contracts: z.array(apiContractSchema), guides: z.array(apiGuideSchema).optional() })
export const columnSchema = z.strictObject({ name: text, type: text, note: text.optional(), key: z.boolean().optional(), change: changeSchema.optional() })
export const tableSchema = z.strictObject({ id, component: id, name: text, description: text.optional(), group: text.optional(), kind: z.enum(['table', 'object', 'local-file']).optional(), change: changeSchema, columns: z.array(columnSchema), note: text.optional() })
export const storageSchema = z.strictObject({ tables: z.array(tableSchema) })
export const testCaseSchema = z.strictObject({ id, title: text, given: text, when: text, then: strings.min(1), status: testStatusSchema.optional(), steps: ids.optional(), contracts: ids.optional(), tables: ids.optional() })
export const testsSchema = z.strictObject({ cases: z.array(testCaseSchema) })
export const sectionSchemas = { purpose: purposeSchema, journey: journeySchema, design: designSchema, flow: flowSchema, api: apiSchema, storage: storageSchema, tests: testsSchema }
export const featureSpecSchema = z.strictObject({
  purpose: purposeSchema.optional(), journey: journeySchema.optional(), design: designSchema.optional(), flow: flowSchema.optional(),
  api: apiSchema.optional(), storage: storageSchema.optional(), tests: testsSchema.optional(),
})
export const workspaceSchema = z.strictObject({ id, slug, order, name: text, description: text.optional(), hue: text, createdAt: z.iso.datetime({ offset: true }) })
export const productSchema = z.strictObject({ id, workspaceId: id, slug, order, name: text, kind: productKindSchema, description: text.optional() })
export const componentKindSchema = z.enum(['service', 'module', 'database', 'object-storage', 'local-storage', 'queue', 'cache', 'external-service'])
export const componentSchema = z.strictObject({ id, productId: id, order, name: text, kind: componentKindSchema.optional(), parentId: id.optional(), dependsOn: ids.optional(), repo: text.optional(), description: text.optional() })
export const memberSchema = z.strictObject({ id, name: text })
export const featureSchema = z.strictObject({ id, productId: id, title: text, summary: text.optional(), stage: featureStageSchema, touches: ids, ownerId: id, updatedAt: z.iso.datetime({ offset: true }) })
export const projectSchema = z.strictObject({ schemaVersion: z.literal(1), viewerId: id.optional() })
export const documentSchemas = { project: projectSchema, workspace: workspaceSchema, product: productSchema, component: componentSchema, member: memberSchema, feature: featureSchema, ...sectionSchemas }
export type FeatureRecord = z.infer<typeof featureSchema>
export type Member = z.infer<typeof memberSchema>
export type Project = z.infer<typeof projectSchema>
