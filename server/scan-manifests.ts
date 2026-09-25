import { z } from 'zod'
import { adaptScanManifest, parseScanManifest, scanManifestSchema } from '../src/data/scan-manifest.ts'
import { catalogIndex } from './catalog.ts'
import { parsePlan, type Files, type Plan } from './format.ts'
import { Conflict, InvalidInput, NotFound } from './errors.ts'
import { digest } from './git.ts'
import { readPlan } from './repository.ts'
import type { ScanMetadata } from './scan-workspace.ts'

type ManifestPlan = Plan & { files: Files; revision: string; layout: 'legacy' | 'catalog-v1' | 'catalog-v3'; repository?: { id: string } }
export type ManifestScope = z.infer<typeof scanManifestSchema>['scope'][number]

export function manifestChange(plan: ManifestPlan, changes: Record<string, string>, input: Omit<z.infer<typeof scanManifestSchema>, 'mappings' | 'note'>) {
  // The candidate is read the way the home itself was, so its layout decides which ID form the mappings record.
  const candidate = { ...plan, ...parsePlan({ ...plan.files, ...changes }, plan.source) }
  const components = new Set(input.scope.map(scope => scope.componentId))
  const mappings: z.infer<typeof scanManifestSchema>['mappings'] = []
  const visit = (value: unknown, entityId: string) => {
    if (Array.isArray(value)) { value.forEach(item => visit(item, entityId)); return }
    if (!value || typeof value !== 'object') return
    const obj = value as Record<string, unknown>
    if (typeof obj.path === 'string' && obj.revision === input.sourceRevision) {
      const repository = typeof obj.repository === 'string' ? obj.repository : input.repository
      mappings.push({ entityId, path: obj.path, revision: input.sourceRevision, repository })
    }
    Object.values(obj).forEach(item => visit(item, entityId))
  }
  for (const entity of catalogIndex(candidate)) if (components.has(entity.component.id)) visit(entity.raw, entity.id)
  const packet = scanManifestSchema.parse({ ...input, mappings: [...new Map(mappings.map(item => [JSON.stringify(item), item])).values()],
    note: 'Files describe the bounded prepared inventory, not proof every file was inspected. Mappings index citations at this revision, '
      + 'not a complete dependency graph. Scope records applied areas/observation IDs. No behavioral or deployed freshness verification is implied.' })
  const raw = JSON.stringify(packet) + '\n'
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new InvalidInput('Scan manifest exceeds 2 MiB; prepare a smaller investigation')
  const manifestId = digest(raw)
  return { manifestId, file: `scan-manifests/${manifestId}.json`, raw }
}

/** The immutable provenance record for applying `metadata` to the catalog with `changes`. */
export function scanManifest(plan: ManifestPlan, changes: Record<string, string>, metadata: ScanMetadata, mode: 'baseline' | 'investigation', scope: ManifestScope[]) {
  return manifestChange(plan, changes, {
    version: 1,
    scannerVersion: metadata.scannerVersion,
    scanId: metadata.id,
    repository: metadata.repository,
    sourceRevision: metadata.revision,
    requestedRef: metadata.requestedRef,
    preparedAt: metadata.createdAt,
    appliedAt: new Date().toISOString(),
    catalogRevisionBefore: plan.revision,
    mode,
    scope,
    exclusions: metadata.excluded,
    budgets: metadata.budgets,
    files: metadata.files,
    dependencyFingerprints: metadata.dependencyFingerprints,
    omittedDependencyFingerprints: metadata.omittedDependencyFingerprints,
  })
}

export const readScanManifestSchema = z.strictObject({
  manifestId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  section: z.enum(['summary', 'files', 'dependencyFingerprints', 'mappings']).default('summary'),
  offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(100).default(20),
  expectedRevision: z.string().optional(),
})
export async function readScanManifest(root: string, input: unknown, ref?: string) {
  const args = readScanManifestSchema.parse(input)
  const plan = await readPlan(root, ref)
  if (args.expectedRevision && args.expectedRevision !== plan.revision) throw new Conflict('Catalog changed; restart manifest listing')
  if (!args.manifestId && args.section !== 'summary') throw new InvalidInput('Select a manifestId for inventory or mapping pages')
  if (!args.manifestId && args.offset && !args.expectedRevision) throw new InvalidInput('Supply expectedRevision when continuing a manifest listing')
  const entries = Object.entries(plan.files).filter(([file]) => file.startsWith('scan-manifests/')).sort(([a], [b]) => a.localeCompare(b))
  /**
   * The stored bytes are validated at whatever version they were written and then read in the layout's canonical
   * ID form. Only a migrated home qualifies its IDs by repository; an unmigrated one keeps the legacy IDs its
   * documents and manifests hold, which is also the form `manifestChange` writes. Only this in-memory view is
   * adapted: the record itself is content-addressed, so its file keeps the exact bytes its name hashes, and the
   * IDs the map cannot place stay as they are.
   */
  const view = (raw: string) => {
    const manifest = parseScanManifest(raw)
    return plan.layout === 'catalog-v3' ? adaptScanManifest(manifest, plan.legacyIds) : manifest
  }
  const summary = (file: string, raw: string) => {
    const { files, dependencyFingerprints, mappings, ...metadata } = view(raw)
    const counts = { files: files.length, dependencyFingerprints: dependencyFingerprints.length, mappings: mappings.length }
    return { manifestId: file.split('/')[1].replace('.json', ''), ...metadata, counts }
  }
  let items: unknown[]
  if (!args.manifestId) items = entries.map(([file, raw]) => summary(file, raw))
  else {
    const file = `scan-manifests/${args.manifestId}.json`, raw = plan.files[file]
    if (!raw) throw new NotFound('Unknown scan manifest')
    items = args.section === 'summary' ? [summary(file, raw)] : view(raw)[args.section]
  }
  const result = {
    catalogRevision: plan.revision, manifestId: args.manifestId ?? null, section: args.section, total: items.length,
    items: items.slice(args.offset, args.offset + args.limit), nextOffset: null as number | null,
  }
  while (Buffer.byteLength(JSON.stringify(result)) > 64000 && result.items.length) result.items.pop()
  if (!result.items.length && args.offset < items.length) throw new InvalidInput('Manifest item exceeds response budget; inspect the stored manifest directly')
  result.nextOffset = args.offset + result.items.length < items.length ? args.offset + result.items.length : null
  return result
}
