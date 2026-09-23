import { z } from 'zod'
import { scanManifestSchema } from '../src/data/scan-manifest.ts'
import { catalogIndex } from './catalog.ts'
import { parsePlan } from './format.ts'
import { digest } from './git.ts'
import { readPlan } from './repository.ts'

export function manifestChange(plan: Awaited<ReturnType<typeof readPlan>>, changes: Record<string, string>, input: Omit<z.infer<typeof scanManifestSchema>, 'mappings' | 'note'>) {
  const candidate = { ...plan, ...parsePlan({ ...plan.files, ...changes }) }
  const components = new Set(input.scope.map(scope => scope.componentId))
  const mappings: z.infer<typeof scanManifestSchema>['mappings'] = []
  const visit = (value: unknown, entityId: string) => {
    if (Array.isArray(value)) { value.forEach(item => visit(item, entityId)); return }
    if (!value || typeof value !== 'object') return
    const obj = value as Record<string, unknown>
    if (typeof obj.path === 'string' && obj.revision === input.sourceRevision) mappings.push({ entityId, path: obj.path, revision: input.sourceRevision, repository: typeof obj.repository === 'string' ? obj.repository : input.repository })
    Object.values(obj).forEach(item => visit(item, entityId))
  }
  for (const entity of catalogIndex(candidate)) if (components.has(entity.component.id)) visit(entity.raw, entity.id)
  const packet = scanManifestSchema.parse({ ...input, mappings: [...new Map(mappings.map(item => [JSON.stringify(item), item])).values()],
    note: 'Files describe the bounded prepared inventory, not proof every file was inspected. Mappings index citations at this revision, not a complete dependency graph. Scope records applied areas/observation IDs. No behavioral or deployed freshness verification is implied.' })
  const raw = JSON.stringify(packet) + '\n'
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new Error('Scan manifest exceeds 2 MiB; prepare a smaller investigation')
  const manifestId = digest(raw)
  return { manifestId, file: `scan-manifests/${manifestId}.json`, raw }
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
  if (args.expectedRevision && args.expectedRevision !== plan.revision) throw new Error('Catalog changed; restart manifest listing')
  if (!args.manifestId && args.section !== 'summary') throw new Error('Select a manifestId for inventory or mapping pages')
  if (!args.manifestId && args.offset && !args.expectedRevision) throw new Error('Supply expectedRevision when continuing a manifest listing')
  const entries = Object.entries(plan.files).filter(([file]) => file.startsWith('scan-manifests/')).sort(([a], [b]) => a.localeCompare(b))
  const summary = (file: string, raw: string) => {
    const { files, dependencyFingerprints, mappings, ...metadata } = scanManifestSchema.parse(JSON.parse(raw))
    return { manifestId: file.split('/')[1].replace('.json', ''), ...metadata, counts: { files: files.length, dependencyFingerprints: dependencyFingerprints.length, mappings: mappings.length } }
  }
  let items: unknown[]
  if (!args.manifestId) items = entries.map(([file, raw]) => summary(file, raw))
  else {
    const file = `scan-manifests/${args.manifestId}.json`, raw = plan.files[file]
    if (!raw) throw new Error('Unknown scan manifest')
    items = args.section === 'summary' ? [summary(file, raw)] : scanManifestSchema.parse(JSON.parse(raw))[args.section]
  }
  const result = { catalogRevision: plan.revision, manifestId: args.manifestId ?? null, section: args.section, total: items.length, items: items.slice(args.offset, args.offset + args.limit), nextOffset: null as number | null }
  while (Buffer.byteLength(JSON.stringify(result)) > 64000 && result.items.length) result.items.pop()
  if (!result.items.length && args.offset < items.length) throw new Error('Manifest item exceeds response budget; inspect the stored manifest directly')
  result.nextOffset = args.offset + result.items.length < items.length ? args.offset + result.items.length : null
  return result
}
