import path from 'node:path'
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises'
import { z } from 'zod'
import { InvalidInput } from './errors.ts'
import { atomicFile, safePath, withLock } from './repository.ts'
import { context } from './git.ts'
import { readPlan } from './repository.ts'
import { NotInitialised } from './format.ts'
import { repositoryIdentity } from '../src/data/repository-identity.ts'

const productRefSchema = z.strictObject({ repository: z.string().min(1), product: z.string().min(1) })
export const hubRegistrySchema = z.strictObject({
  version: z.literal(3),
  checkouts: z.record(z.string().min(1), z.array(z.string().min(1))),
  workspaces: z.array(z.strictObject({ name: z.string().min(1), products: z.array(productRefSchema) })),
})
export type HubRegistry = z.infer<typeof hubRegistrySchema>
export type ProductRef = z.infer<typeof productRefSchema>
export const emptyHubRegistry = (): HubRegistry => ({ version: 3, checkouts: {}, workspaces: [] })
export const hubRegistryFile = 'registry-v3.json'

/** Null means the v3 file does not exist, so callers can keep serving the older registry. */
export async function readHubRegistry(configRoot: string): Promise<HubRegistry | null> {
  if (!await lstat(configRoot).then(stat => stat.isDirectory(), error => {
    if (error.code === 'ENOENT') return false
    throw error
  })) return null
  const file = await safePath(configRoot, hubRegistryFile)
  const raw = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (raw === null) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch (error) { throw new InvalidInput(`${file}: ${(error as Error).message}`, { cause: error }) }
  const parsed = hubRegistrySchema.safeParse(value)
  if (!parsed.success) throw new InvalidInput(`${file}: ${z.prettifyError(parsed.error)}`, { cause: parsed.error })
  return parsed.data
}

export async function writeHubRegistry(configRoot: string, update: (current: HubRegistry) => HubRegistry) {
  await mkdir(configRoot, { recursive: true })
  return withLock(configRoot, async () => {
    const next = hubRegistrySchema.parse(update((await readHubRegistry(configRoot)) ?? emptyHubRegistry()))
    await atomicFile(configRoot, hubRegistryFile, JSON.stringify(next, null, 2) + '\n')
    return next
  }, 'registry-v3.lock')
}

export interface LegacyRegistration { root: string; workspace: string; product: string; projectId: string | null }
/** Each ambiguous v2 display label must be confirmed as an exact home repository and fixed product ID. */
export type LabelMappings = Record<string, ProductRef>
export const labelMappingKey = (record: Pick<LegacyRegistration, 'workspace' | 'product'>) =>
  JSON.stringify([record.workspace, record.product])
export const registrationMappingKey = (record: Pick<LegacyRegistration, 'workspace' | 'product' | 'root'>) =>
  JSON.stringify([record.workspace, record.product, path.resolve(record.root)])

export async function previewRegistryMigration(projects: LegacyRegistration[], mappings: LabelMappings = {}) {
  const checkouts: HubRegistry['checkouts'] = {}
  const workspaceProducts = new Map<string, ProductRef[]>()
  const unresolved: { key: string; workspace: string; product: string; roots: string[]; registrationKeys: string[]; candidates: ProductRef[] }[] = []
  const grouped = new Map<string, { record: LegacyRegistration; index: number }[]>()
  for (const [index, record] of projects.entries()) {
    const root = await realpath(record.root).catch(() => path.resolve(record.root))
    const repository = repositoryIdentity((await context(root).catch(() => null))?.repository.id ?? `local:${path.basename(root)}`)
    if (!checkouts[repository]) checkouts[repository] = []
    if (!checkouts[repository].includes(root)) checkouts[repository].push(root)
    const key = labelMappingKey(record)
    grouped.set(key, [...(grouped.get(key) ?? []), { record, index }])
  }
  const homePlans = await Promise.all(projects.map(async record => {
    const plan = await readPlan(record.root).catch(error => {
      if (error instanceof NotInitialised) return null
      throw error
    })
    return plan ? { repository: repositoryIdentity(plan.repository.id), products: plan.snapshot.products } : null
  }))
  const candidates = homePlans.flatMap(plan => plan?.products.map(product => ({ repository: plan.repository, product: product.id })) ?? [])
  for (const [key, records] of grouped) {
    const [workspace, product] = JSON.parse(key) as [string, string]
    // Two independent homes may use the same free-text v2 label. A label-wide mapping would silently drop one;
    // require a confirmed mapping for each registration in that case, including source-only registrations.
    const collision = new Set(records.map(({ index }) => homePlans[index]?.repository).filter(Boolean)).size > 1
    const refs = workspaceProducts.get(workspace) ?? []
    const missing: string[] = []
    for (const { record, index } of records) {
      const mapped = mappings[registrationMappingKey(record)] ?? (!collision ? mappings[key] : undefined)
      const ref = mapped && { repository: repositoryIdentity(mapped.repository), product: mapped.product }
      const valid = ref && candidates.some(candidate => candidate.repository === ref.repository && candidate.product === ref.product)
        && (!homePlans[index]?.products.length || homePlans[index]?.repository === ref.repository
          && homePlans[index]?.products.some(candidate => candidate.id === ref.product))
      if (!valid) { missing.push(record.root); continue }
      if (!refs.some(item => item.repository === ref.repository && item.product === ref.product)) refs.push(ref)
    }
    if (missing.length) unresolved.push({ key, workspace, product, roots: missing,
      registrationKeys: records.filter(({ record }) => missing.includes(record.root)).map(({ record }) => registrationMappingKey(record)), candidates })
    if (refs.length) workspaceProducts.set(workspace, refs)
  }
  const workspaces = [...workspaceProducts].map(([name, products]) => ({ name, products }))
  return { registry: hubRegistrySchema.parse({ version: 3, checkouts, workspaces }), unresolved, candidates,
    checkoutCount: Object.values(checkouts).reduce((sum, roots) => sum + roots.length, 0), workspaceCount: new Set(projects.map(item => item.workspace)).size }
}
