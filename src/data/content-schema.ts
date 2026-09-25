import { z } from 'zod'
import { documentVersions } from './document-versions.ts'
import { commitSha, httpMethodSchema, id, isoTimestamp, observationKindSchema, text, isRepoRelativePath } from './schema-primitives.ts'

// This is the source of truth for runtime validation, TypeScript types and JSON Schema.
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
  logic: z.strictObject({
    expression: text, explanation: text.optional(), branches: z.array(z.strictObject({ edgeId: id, when: text, then: text })),
  }).optional(),
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
  method: httpMethodSchema.optional(), path: text,
  request: text.optional(), response: text.optional(), responseSchema: responseSchema.optional(), note: text.optional(),
})
export const apiGuideSchema = z.strictObject({
  componentId: id, overview: text, featureImpact: text,
  capabilities: z.array(z.strictObject({ id, title: text, description: text, contractIds: ids })),
})
export const apiSchema = z.strictObject({ contracts: z.array(apiContractSchema), guides: z.array(apiGuideSchema).optional() })
export const columnSchema = z.strictObject({ name: text, type: text, note: text.optional(), key: z.boolean().optional(), change: changeSchema.optional() })
export const tableSchema = z.strictObject({
  id, component: id, name: text, description: text.optional(), group: text.optional(), kind: z.enum(['table', 'object', 'local-file']).optional(),
  change: changeSchema, columns: z.array(columnSchema), note: text.optional(),
})
export const storageSchema = z.strictObject({ tables: z.array(tableSchema) })
export const testCaseSchema = z.strictObject({
  id, title: text, given: text, when: text, then: strings.min(1), status: testStatusSchema.optional(),
  steps: ids.optional(), contracts: ids.optional(), tables: ids.optional(),
})
export const testsSchema = z.strictObject({ cases: z.array(testCaseSchema) })
export const sectionSchemas = {
  purpose: purposeSchema, journey: journeySchema, design: designSchema, flow: flowSchema, api: apiSchema, storage: storageSchema, tests: testsSchema,
}
export const featureSpecSchema = z.strictObject({
  purpose: purposeSchema.optional(), journey: journeySchema.optional(), design: designSchema.optional(), flow: flowSchema.optional(),
  api: apiSchema.optional(), storage: storageSchema.optional(), tests: testsSchema.optional(),
})
export const workspaceSchema = z.strictObject({ id, slug, order, name: text, description: text.optional(), hue: text, createdAt: isoTimestamp })
export const productSchema = z.strictObject({ id, workspaceId: id, slug, order, name: text, kind: productKindSchema, description: text.optional() })
/** A product's repository membership in the migrated form: which repositories, or paths inside them, it owns or uses. */
export const productRepositorySchema = z.strictObject({
  repository: text, role: z.enum(['owned', 'used']),
  paths: z.array(text.refine(value => value === '.' || isRepoRelativePath(value.replaceAll('*', 'x')),
    'Repository-relative path pattern required')).optional(),
  aliases: strings.optional(),
})
/**
 * Read-tolerant product: every legacy field plus the fields a migrated home writes. Readers accept both forms;
 * writes still produce `productSchema`, so a teammate on an older release can still read what this one writes.
 */
export const productReadSchema = productSchema.omit({ workspaceId: true }).extend({
  workspaceId: id.optional(), schemaVersion: z.literal(documentVersions.product.current).optional(),
  domain: z.url().optional(), repositories: z.array(productRepositorySchema).optional(),
})
export const componentKindSchema = z.enum(['service', 'module', 'database', 'object-storage', 'local-storage', 'queue', 'cache', 'external-service'])
export const componentEvidenceSchema = z.strictObject({
  path: text, lines: text, claim: text, revision: text, repository: text.optional(),
})
export const componentApiEndpointSchema = z.strictObject({
  id, name: text, method: httpMethodSchema, path: text,
  version: text.optional(), summary: text.optional(), request: text.optional(), response: text.optional(), source: text.optional(),
  evidence: z.array(componentEvidenceSchema).optional(),
})
export const componentApiFieldSchema = z.strictObject({
  name: text, type: text, required: z.boolean(), description: text.optional(), line: z.number().int().positive().optional(),
})
export const componentApiTypeSchema = z.strictObject({
  id: text, name: text, kind: z.enum(['class', 'record', 'enum']), base: text.optional(), description: text.optional(),
  fields: z.array(componentApiFieldSchema), source: text.optional(), sourceUrl: z.url().optional(), sourceRevision: text.optional(),
  evidence: z.array(componentEvidenceSchema).optional(),
})
export const componentApiSchema = z.strictObject({
  name: text, version: text.optional(), versions: z.array(z.strictObject({ id: text, label: text })).optional(), sourceRevision: text.optional(),
  specification: z.strictObject({
    url: z.url(), title: text, availability: z.enum(['available', 'unavailable', 'unknown']),
    kind: text.optional(), source: text.optional(), lastCheckedAt: isoTimestamp.optional(), lastStatus: z.number().int().nonnegative().optional(),
  }).optional(),
  endpoints: z.array(componentApiEndpointSchema), schemas: z.array(componentApiTypeSchema).optional(),
})
export const componentDataSchema = z.strictObject({
  technology: text.optional(), access: z.array(z.enum(['read', 'write'])).optional(), gaps: strings.optional(),
  records: z.array(z.strictObject({
    id, name: text, kind: z.enum(['document', 'record', 'keyspace', 'message']), description: text.optional(),
    keyPattern: text.optional(), ttl: text.nullable().optional(), fields: z.array(componentApiFieldSchema),
    evidence: z.array(componentEvidenceSchema).optional(),
  })),
})
export const componentMessagingSchema = z.strictObject({
  messages: z.array(z.strictObject({
    id, name: text, broker: text, channel: text, direction: z.enum(['inbound', 'outbound']),
    fields: z.array(componentApiFieldSchema),
    delivery: z.strictObject({ ordering: text, retries: text, deadLetter: text }),
    evidence: z.array(componentEvidenceSchema).optional(),
  })),
  gaps: strings.optional(),
})
export const componentScanAreaSchema = z.enum(['not-scanned', 'partial', 'complete'])
export const componentScanSchema = z.strictObject({
  status: z.enum(['not-scanned', 'scanning', 'partial', 'complete', 'failed']), sourceFingerprint: text.optional(),
  scannedAt: isoTimestamp.optional(), revision: text.optional(), error: text.optional(),
  coverage: z.strictObject({
    dependencies: componentScanAreaSchema.optional(), api: componentScanAreaSchema.optional(),
    data: componentScanAreaSchema.optional(), messaging: componentScanAreaSchema.optional(),
  }).optional(),
})
export const componentGapSchema = z.strictObject({ area: text, reason: text })
/** Evidence pinned to a line range at a full commit; scan inputs reuse it with a repository-relative path. */
export const evidenceSchema = componentEvidenceSchema.extend({
  lines: z.string().regex(/^[1-9]\d*(?:-[1-9]\d*)?$/, 'Use a line number or inclusive range such as 12-24'),
  revision: commitSha,
})
export const executionFlowStepSchema = z.strictObject({
  id, title: text,
  kind: z.enum(['request', 'validation', 'decision', 'logic', 'dependency', 'data', 'message', 'response']),
  description: text,
  dataRecordIds: ids.optional(), messageIds: ids.optional(), dependencyIds: ids.optional(),
  unresolvedDependencyNames: strings.optional(),
  evidence: z.array(evidenceSchema).min(1),
})
export const executionFlowSchema = z.strictObject({
  id, endpointId: id.optional(),
  trigger: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('message'), messageId: id }), z.strictObject({ kind: z.literal('job'), jobId: id }),
  ]).optional(),
  name: text, summary: text,
  sourceRevision: commitSha,
  entryStepId: id,
  steps: z.array(executionFlowStepSchema).min(1),
  transitions: z.array(z.strictObject({
    id, from: id, to: id, label: text,
    mode: z.enum(['sync', 'async']),
    evidence: z.array(evidenceSchema).min(1),
  })),
  gaps: strings,
})
export const componentUnresolvedDependencySchema = z.strictObject({
  name: text, kind: text.optional(), transport: text.optional(), evidence: z.array(componentEvidenceSchema).min(1),
})
export const catalogFindingSchema = z.strictObject({
  id, name: text.max(200), question: text.max(2000), answer: text.max(8000),
  subjects: z.array(z.strictObject({ kind: z.enum(['component', ...observationKindSchema.options]), id: text })).min(1).max(10),
  boundary: text.max(4000), assumptions: strings.max(20),
  repository: text, sourceRevision: commitSha,
  evidence: z.array(evidenceSchema).min(1).max(40),
})
export const retiredObservationSchema = z.strictObject({
  kind: observationKindSchema, id, retiredAt: isoTimestamp, sourceRevision: commitSha, reason: text,
  evidence: z.array(evidenceSchema).min(1), observation: z.record(z.string(), z.unknown()),
})
export const componentJobSchema = z.strictObject({
  id, name: text, description: text, schedule: text.optional(), source: text.optional(), evidence: z.array(componentEvidenceSchema).min(1),
})
/**
 * A build project that was renamed or moved. The component keeps the document ID it already had; the change records
 * the ID and path a scan of the new location derives, so a later scan matches the project instead of cataloguing it
 * again. Only a migrated home stores it: an older release validates components against a strict schema and would
 * refuse the whole document, and no legacy field can carry the same fact.
 */
export const componentIdentityChangeSchema = z.strictObject({
  previousId: id, previousSourcePath: text, id, sourcePath: text, recordedAt: isoTimestamp, reason: text,
  sourceRevision: commitSha, evidence: z.array(evidenceSchema).min(1),
})
export const componentSchema = z.strictObject({
  id, productId: id, order, name: text, kind: componentKindSchema.optional(), parentId: id.optional(), dependsOn: ids.optional(),
  repo: text.optional(), description: text.optional(), ownership: z.enum(['internal', 'third-party']).optional(),
  role: z.enum(['business-service', 'platform-service', 'external-provider']).optional(),
  api: componentApiSchema.optional(), data: componentDataSchema.optional(), messaging: componentMessagingSchema.optional(),
  catalogChanges: z.array(z.strictObject({
    kind: observationKindSchema, id, nameBefore: text, nameAfter: text, pathBefore: text.optional(), pathAfter: text.optional(),
    sourceRevision: commitSha, evidence: z.array(evidenceSchema).min(1),
  })).optional(),
  retiredObservations: z.array(retiredObservationSchema).optional(),
  jobs: z.array(componentJobSchema).optional(),
  executionFlows: z.array(executionFlowSchema).optional(),
  findings: z.array(catalogFindingSchema).optional(),
  sourcePath: text.optional(), sourceRevision: text.optional(), evidence: z.array(componentEvidenceSchema).optional(),
  gaps: z.array(componentGapSchema).optional(), unresolvedDependencies: z.array(componentUnresolvedDependencySchema).optional(),
  scan: componentScanSchema.optional(),
})
/**
 * A stored reference to a component: the migrated form names the repository, because components are qualified by
 * repository rather than by product, and the legacy form is the bare local name. Both are read; only the bare form
 * is written until a home is migrated.
 */
export const componentReferenceSchema = z.union([id, z.strictObject({ repository: text, component: id })])
const componentReferences = z.array(componentReferenceSchema)
const executionFlowStepReadSchema = executionFlowStepSchema.extend({ dependencyIds: componentReferences.optional() })
export const executionFlowReadSchema = executionFlowSchema.extend({ steps: z.array(executionFlowStepReadSchema).min(1) })
/**
 * Read-tolerant component: every legacy field plus what a migrated home writes, namely its own `schemaVersion`,
 * structured `{repository, component}` references in `dependsOn` and flow `dependencyIds`, and the identity changes
 * a renamed or moved build project records. Writes still produce `componentSchema`, so a teammate on an older
 * release can still read them.
 */
export const componentReadSchema = componentSchema.extend({
  productId: id.optional(),
  schemaVersion: z.literal(documentVersions.component.current).optional(),
  dependsOn: componentReferences.optional(),
  executionFlows: z.array(executionFlowReadSchema).optional(),
  identityChanges: z.array(componentIdentityChangeSchema).optional(),
})
export const memberSchema = z.strictObject({ id, name: text })
export const featureSchema = z.strictObject({
  id, productId: id, title: text, summary: text.optional(), stage: featureStageSchema, touches: ids, ownerId: id, updatedAt: isoTimestamp,
})
export const projectSchema = z.strictObject({ schemaVersion: z.literal(1), viewerId: id.optional() })
export const documentSchemas = {
  project: projectSchema, workspace: workspaceSchema, product: productSchema, component: componentSchema, member: memberSchema, feature: featureSchema,
  ...sectionSchemas,
}
export type FeatureRecord = z.infer<typeof featureSchema>
export type Member = z.infer<typeof memberSchema>
export type Project = z.infer<typeof projectSchema>
