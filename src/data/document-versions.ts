/**
 * Version policy per document family. Mutable JSON documents, such as products and components, carry their own
 * `schemaVersion`: readers accept every supported version and writers produce only the current one. A document
 * without a version is read as the legacy version for its type, never as the current format. Content-addressed
 * records, such as scan manifests, keep their existing `version` field and are never rewritten, so readers must
 * support every version ever written and translate through a field-aware adapter instead.
 */
export const documentFamilies = ['product', 'component', 'workspace', 'member', 'feature', 'section'] as const
export type DocumentFamily = typeof documentFamilies[number]

export interface VersionPolicy {
  /** The version a document with no `schemaVersion` is read as. */
  legacy: number
  /** The version this release writes into a migrated home. */
  current: number
  /** Every version this release reads, in ascending order. */
  supported: readonly number[]
}

/**
 * Only products and components change shape in the workspace migration. The other families have one version, so
 * their legacy and current versions are the same and a `schemaVersion` never appears in them.
 */
export const documentVersions: Record<DocumentFamily, VersionPolicy> = {
  product: { legacy: 1, current: 3, supported: [1, 3] },
  component: { legacy: 1, current: 3, supported: [1, 3] },
  workspace: { legacy: 1, current: 1, supported: [1] },
  member: { legacy: 1, current: 1, supported: [1] },
  feature: { legacy: 1, current: 1, supported: [1] },
  section: { legacy: 1, current: 1, supported: [1] },
}

/** The version a loaded document is read as: its own `schemaVersion`, or its family's legacy version. */
export function documentVersion(family: DocumentFamily, value: unknown): number {
  const policy = documentVersions[family]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return policy.legacy
  const declared = (value as { schemaVersion?: unknown }).schemaVersion
  return typeof declared === 'number' ? declared : policy.legacy
}

export const isSupportedVersion = (family: DocumentFamily, version: number) => documentVersions[family].supported.includes(version)
/** Whether a loaded document is in the migrated form for its family. */
export const isMigratedDocument = (family: DocumentFamily, value: unknown) =>
  documentVersion(family, value) === documentVersions[family].current && documentVersions[family].current !== documentVersions[family].legacy
