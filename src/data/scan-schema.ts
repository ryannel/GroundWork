import { z } from 'zod'
import {
  catalogFindingSchema,
  componentApiSchema,
  componentDataSchema,
  componentGapSchema,
  componentJobSchema,
  componentKindSchema,
  componentMessagingSchema,
  componentScanAreaSchema,
  componentUnresolvedDependencySchema,
  evidenceSchema,
  executionFlowSchema,
} from './content-schema.ts'
import { hasCredentials } from './repository-identity.ts'
import { commitSha, id, observationKindSchema, repoRelativePath, text } from './schema-primitives.ts'

// Input schemas for the repository scan operations. They are shared by the runtime and the JSON-schema generator.

export const scanAreas = ['dependencies', 'api', 'data', 'messaging'] as const
export const scanAreaSchema = z.enum(scanAreas)
export type ScanArea = z.infer<typeof scanAreaSchema>

/** A Git object ID: SHA-1 (40 hex) or SHA-256 (64 hex). Used for commits and blob digests. */
export const objectIdSchema = commitSha

/** A branch, tag or commit to scan. It never starts with `-`, so Git cannot read it as an option. */
export const sourceRefSchema = z.string().trim().min(1).max(255)
  .regex(/^(?!-)[^\s\0~^:?*[\\]+$/, 'Use a branch, tag or commit hash; refs cannot start with "-" or contain spaces or ~^:?*[\\')
  .refine(value => !value.includes('..') && !value.includes('@{'), 'Use a branch, tag or commit hash, not a revision expression')

/** A repository to scan: a local path, `owner/name` or a Git URL. Credentials belong in a credential helper, never in the catalog. */
export const scanRepositorySchema = z.string().trim().min(1).max(2048)
  .refine(value => !hasCredentials(value), 'Remove credentials from the repository URL; use a Git credential helper or gh auth instead')

export const scanBudgetsSchema = z.strictObject({
  maxFiles: z.number().int().min(1).max(5000).default(1200),
  maxBytes: z.number().int().min(1024).max(100 * 1024 * 1024).default(20 * 1024 * 1024),
  maxFilesPerPacket: z.number().int().min(1).max(250).default(80),
  maxPackets: z.number().int().min(1).max(128).default(32),
}).default({ maxFiles: 1200, maxBytes: 20 * 1024 * 1024, maxFilesPerPacket: 80, maxPackets: 32 })
export type ScanBudgets = z.infer<typeof scanBudgetsSchema>

export const scanEvidenceSchema = evidenceSchema.extend({ path: repoRelativePath })
export type ScanEvidence = z.infer<typeof scanEvidenceSchema>

export const prepareRepositoryScanSchema = z.strictObject({
  repository: scanRepositorySchema,
  sourceRef: sourceRefSchema.optional(),
  areas: z.array(scanAreaSchema).min(1).default([...scanAreas]),
  budgets: scanBudgetsSchema,
  incremental: z.strictObject({ ids: z.array(z.string().min(1)).min(1).max(20) }).optional(),
})

export const repositoryDiscoverySchema = z.strictObject({
  id,
  productId: id,
  sourcePath: repoRelativePath,
  name: z.string().trim().min(1),
  order: z.number().int().optional(),
  kind: componentKindSchema.optional(),
  description: z.string().trim().min(1).optional(),
  ownership: z.enum(['internal', 'third-party']).optional(),
  role: z.enum(['business-service', 'platform-service', 'external-provider']).optional(),
  dependsOn: z.array(id).optional(),
  unresolvedDependencies: z.array(componentUnresolvedDependencySchema).optional(),
  api: componentApiSchema.optional(),
  data: componentDataSchema.optional(),
  messaging: componentMessagingSchema.optional(),
  jobs: z.array(componentJobSchema).optional(),
  executionFlows: z.array(executionFlowSchema).optional(),
  evidence: z.array(scanEvidenceSchema).optional(),
  gaps: z.array(componentGapSchema).optional(),
  coverage: z.strictObject({
    dependencies: componentScanAreaSchema.optional(),
    api: componentScanAreaSchema.optional(),
    data: componentScanAreaSchema.optional(),
    messaging: componentScanAreaSchema.optional(),
  }),
})
export type RepositoryDiscovery = z.infer<typeof repositoryDiscoverySchema>

export const applyRepositoryScanSchema = z.strictObject({
  scanId: z.string().uuid(),
  expectedRevision: z.string().min(1),
  expectedContext: z.string().min(1),
  discoveries: z.array(repositoryDiscoverySchema).min(1),
})

export const discardRepositoryScanSchema = z.strictObject({ scanId: z.string().uuid() })

/** Targeted upserts do not replace contracts, siblings, gaps, or broad scan coverage. */
export const applyCatalogInvestigationSchema = z.strictObject({
  sourceScans: z.array(z.string().uuid()).max(5).default([]),
  scanId: z.string().uuid(),
  componentId: id,
  expectedRevision: z.string().min(1),
  expectedContext: z.string().min(1),
  jobs: z.array(componentJobSchema).max(10).default([]),
  flows: z.array(executionFlowSchema).max(10).default([]),
  findings: z.array(catalogFindingSchema).max(10).default([]),
})

const lifecycleEvidence = z.array(scanEvidenceSchema).min(1).max(20)
export const reconcileCatalogSchema = z.strictObject({
  scanId: z.string().uuid(),
  componentId: id,
  expectedRevision: z.string().min(1),
  expectedContext: z.string().min(1),
  retire: z.array(z.strictObject({
    kind: observationKindSchema, id, reason: text.max(4000), evidence: lifecycleEvidence,
  })).max(20).default([]),
  rename: z.array(z.strictObject({
    kind: observationKindSchema, id, name: text, path: text.optional(), evidence: lifecycleEvidence,
  })).max(20).default([]),
})
export type LifecycleRetirement = z.infer<typeof reconcileCatalogSchema>['retire'][number]
