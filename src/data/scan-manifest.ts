import { z } from 'zod'
import { objectIdSchema } from './scan-schema.ts'
import { repoRelativePath } from './schema-primitives.ts'

export const scanManifestSchema = z.strictObject({
  version: z.literal(1), scannerVersion: z.number().int().positive(), scanId: z.string().uuid(),
  repository: z.string().min(1), sourceRevision: objectIdSchema, requestedRef: z.string().nullable(),
  preparedAt: z.iso.datetime(), appliedAt: z.iso.datetime(), catalogRevisionBefore: z.string().min(1),
  mode: z.enum(['baseline', 'investigation']),
  scope: z.array(z.strictObject({
    componentId: z.string().min(1), sourcePath: z.string().min(1), areas: z.array(z.string()), observationIds: z.array(z.string()),
  })).min(1),
  exclusions: z.record(z.string(), z.number().int().nonnegative()),
  budgets: z.record(z.string(), z.number().int().positive()),
  files: z.array(z.strictObject({ path: repoRelativePath, digest: objectIdSchema, bytes: z.number().int().nonnegative() })).max(5000),
  dependencyFingerprints: z.array(z.strictObject({ path: repoRelativePath, digest: objectIdSchema })).max(10000),
  omittedDependencyFingerprints: z.number().int().nonnegative(),
  mappings: z.array(z.strictObject({ entityId: z.string().min(1), path: repoRelativePath, revision: objectIdSchema, repository: z.string().optional() })),
  note: z.string().min(1),
})
