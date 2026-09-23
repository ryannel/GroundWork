import { chmod, lstat, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { objectIdSchema, scanAreaSchema, scanBudgetsSchema } from '../src/data/scan-schema.ts'
import { repoRelativePath } from '../src/data/schema-primitives.ts'
import type { checkCatalogFreshness } from './catalog-freshness.ts'

/** Prepared scans expire, and are swept, after this long. */
export const SCAN_TTL_MS = 24 * 60 * 60 * 1000
export const SCANNER_VERSION = 2

const scanIdSchema = z.string().uuid()
const inventoryFileSchema = z.strictObject({ path: repoRelativePath, digest: objectIdSchema, bytes: z.number().int().nonnegative() })
type FreshnessReport = Awaited<ReturnType<typeof checkCatalogFreshness>>

/** `scan.json`: written by preparation and validated on every load, since the worker can reach the scan directory. */
export const scanMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  scannerVersion: z.literal(SCANNER_VERSION),
  id: scanIdSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  requestedRef: z.string().nullable(),
  budgets: scanBudgetsSchema,
  dependencyFingerprints: z.array(z.strictObject({ path: repoRelativePath, digest: objectIdSchema })),
  omittedDependencyFingerprints: z.number().int().nonnegative(),
  repository: z.string().min(1),
  revision: objectIdSchema,
  targetProjectId: z.string().min(1),
  targetCheckoutId: z.string().min(1),
  areas: z.array(scanAreaSchema).min(1),
  files: z.array(inventoryFileSchema),
  projects: z.array(z.strictObject({
    path: repoRelativePath, name: z.string(), suggestedId: z.string().min(1), manifest: z.string(), existingComponentId: z.string().optional(),
  })),
  packets: z.array(z.strictObject({
    id: z.string().min(1), projectPath: repoRelativePath, componentId: z.string().min(1), area: scanAreaSchema,
    files: z.array(repoRelativePath), availableFiles: z.number().int().nonnegative(), outputPath: z.string().min(1),
  })),
  excluded: z.record(z.string(), z.number().int().nonnegative()),
  incremental: z.strictObject({
    mode: z.enum(['unchanged', 'focused', 'broader-review']),
    report: z.custom<FreshnessReport>(value => !!value && typeof value === 'object'),
  }).optional(),
})
export type ScanMetadata = z.infer<typeof scanMetadataSchema>
export type WorkPacket = ScanMetadata['packets'][number]
export interface LoadedScan { directory: string; metadata: ScanMetadata }

/** A per-user directory, so another account on a shared host cannot pre-create or read it. */
export function scanBase() {
  const uid = process.getuid?.()
  const name = uid === undefined ? 'groundwork-scans' : `groundwork-scans-${uid}`
  return path.join(path.resolve(process.env.GROUNDWORK_TMPDIR ?? os.tmpdir()), name)
}

async function ensureScanBase() {
  const base = scanBase()
  await mkdir(base, { recursive: true, mode: 0o700 })
  const info = await lstat(base)
  const uid = process.getuid?.()
  if (!info.isDirectory() || (uid !== undefined && info.uid !== uid)) throw new Error(`${base} is not a directory owned by the current user`)
  await chmod(base, 0o700)
  return base
}

export function scanDirectory(id: string) {
  if (!scanIdSchema.safeParse(id).success) throw new Error('Invalid scan ID')
  return path.join(scanBase(), id)
}

/** Restores write access to directories so they can be removed. Symlinks are never followed; `rm` removes the link itself. */
async function makeWritable(target: string) {
  const info = await lstat(target).catch(() => null)
  if (!info?.isDirectory()) return
  await chmod(target, 0o700)
  for (const name of await readdir(target)) await makeWritable(path.join(target, name))
}

export async function removeScan(directory: string) {
  await makeWritable(directory)
  await rm(directory, { recursive: true, force: true })
}

/** Removes expired scans. One scan that cannot be removed never blocks the others or a new preparation. */
export async function sweepScans(now = Date.now()) {
  const base = await ensureScanBase()
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || (!scanIdSchema.safeParse(entry.name).success && !entry.name.startsWith('pending-'))) continue
    const directory = path.join(base, entry.name)
    try {
      const expiresAt = await readFile(path.join(directory, 'scan.json'), 'utf8')
        .then(raw => Date.parse(JSON.parse(raw).expiresAt))
        .catch(() => Number.NaN)
      const expired = Number.isFinite(expiresAt) ? expiresAt < now : now - (await stat(directory)).mtimeMs > SCAN_TTL_MS
      if (expired) await removeScan(directory)
    } catch (error) {
      console.error(`Could not remove expired repository scan ${entry.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return base
}

/** Makes the snapshot read-only for the worker. The snapshot holds only regular files and directories. */
export async function readonlyTree(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) { await readonlyTree(target); await chmod(target, 0o500) }
    else if (entry.isFile()) await chmod(target, 0o400)
  }
  await chmod(directory, 0o500)
}

export async function loadScan(id: string): Promise<LoadedScan> {
  const directory = scanDirectory(id)
  const parsed = scanMetadataSchema.safeParse(JSON.parse(await readFile(path.join(directory, 'scan.json'), 'utf8')))
  if (!parsed.success || parsed.data.id !== id) throw new Error('Invalid scan metadata; prepare a new scan')
  if (Date.parse(parsed.data.expiresAt) < Date.now()) throw new Error('Repository scan expired; prepare a new scan')
  return { directory, metadata: parsed.data }
}
