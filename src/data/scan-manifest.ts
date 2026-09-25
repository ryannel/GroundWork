import { z } from 'zod'
import { parseCatalogId, recordLegacyScope, translateCatalogId, type LegacyIdMap } from './catalog-identity.ts'
import { objectIdSchema } from './scan-schema.ts'
import { isoTimestamp, repoRelativePath } from './schema-primitives.ts'

export const scanManifestSchema = z.strictObject({
  version: z.literal(1), scannerVersion: z.number().int().positive(), scanId: z.string().uuid(),
  repository: z.string().min(1), sourceRevision: objectIdSchema, requestedRef: z.string().nullable(),
  preparedAt: isoTimestamp, appliedAt: isoTimestamp, catalogRevisionBefore: z.string().min(1),
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

export type ScanManifest = z.infer<typeof scanManifestSchema>
/** Every record version this build can read. Records are content-addressed, so a stored one is never rewritten. */
export const scanManifestSchemas = { 1: scanManifestSchema } as const
export const scanManifestVersions = Object.keys(scanManifestSchemas).map(Number)
export const currentScanManifestVersion = 1

/**
 * Reads a stored record at whatever version it was written. The parsed value is a view: the bytes stay exactly as
 * they were hashed, so the manifest ID still verifies.
 */
export function parseScanManifest(raw: string): ScanManifest {
  const value = JSON.parse(raw) as { version?: unknown }
  const schema = scanManifestSchemas[value.version as keyof typeof scanManifestSchemas]
  if (!schema) throw new Error(`Unsupported scan manifest version ${String(value.version)}`)
  return schema.parse(value)
}

/**
 * Which fields of a record at a given version hold catalog IDs, and which repository each of those IDs belongs to.
 * Adapters are field-aware per version so a later record shape can move or add ID-bearing fields.
 */
export function scanManifestCatalogIds(manifest: ScanManifest) {
  const ids: { id: string; repository: string }[] = []
  for (const scope of manifest.scope) for (const id of scope.observationIds) ids.push({ id, repository: manifest.repository })
  for (const mapping of manifest.mappings) ids.push({ id: mapping.entityId, repository: mapping.repository ?? manifest.repository })
  return ids
}

/**
 * Records what a manifest proves about its IDs: which repository each legacy scope and component belonged to.
 * `homeScope` is the legacy scope of the home that stores the record, which qualifies the scoped component IDs
 * the record keeps unqualified.
 */
export function recordScanManifestScopes(map: LegacyIdMap, manifest: ScanManifest, homeScope: string) {
  for (const { id, repository } of scanManifestCatalogIds(manifest)) {
    try {
      const parsed = parseCatalogId(id)
      recordLegacyScope(map, parsed.scope, parsed.component, repository)
    } catch { /* Not a catalog ID; nothing to translate it to. */ }
  }
  for (const scope of manifest.scope) recordLegacyScope(map, homeScope, scope.componentId, manifest.repository)
}

/**
 * The record read through the migrated IDs, where the map can say what they are. An ID the map cannot resolve is
 * kept exactly as written; it is never guessed.
 */
export function adaptScanManifest(manifest: ScanManifest, map: LegacyIdMap): ScanManifest {
  const translate = (id: string) => translateCatalogId(id, map) ?? id
  return {
    ...manifest,
    scope: manifest.scope.map(scope => ({ ...scope, observationIds: scope.observationIds.map(translate) })),
    mappings: manifest.mappings.map(mapping => ({ ...mapping, entityId: translate(mapping.entityId) })),
  }
}
