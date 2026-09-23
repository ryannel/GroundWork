import { z } from 'zod'
const hash = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
const relative = z.string().min(1).max(4096).refine(value => !value.startsWith('/') && !value.includes('\\') && !value.split('/').some(part => !part || part === '..'), 'Repository-relative path required')
export const scanManifestSchema = z.strictObject({
  version: z.literal(1), scannerVersion: z.number().int().positive(), scanId: z.string().uuid(),
  repository: z.string().min(1), sourceRevision: hash, requestedRef: z.string().nullable(),
  preparedAt: z.iso.datetime(), appliedAt: z.iso.datetime(), catalogRevisionBefore: z.string().min(1),
  mode: z.enum(['baseline', 'investigation']),
  scope: z.array(z.strictObject({ componentId: z.string().min(1), sourcePath: z.string().min(1), areas: z.array(z.string()), observationIds: z.array(z.string()) })).min(1),
  exclusions: z.record(z.string(), z.number().int().nonnegative()),
  budgets: z.record(z.string(), z.number().int().positive()),
  files: z.array(z.strictObject({ path: relative, digest: hash, bytes: z.number().int().nonnegative() })).max(5000),
  dependencyFingerprints: z.array(z.strictObject({ path: relative, digest: hash })).max(10000),
  omittedDependencyFingerprints: z.number().int().nonnegative(),
  mappings: z.array(z.strictObject({ entityId: z.string().min(1), path: relative, revision: hash, repository: z.string().optional() })),
  note: z.string().min(1),
})
