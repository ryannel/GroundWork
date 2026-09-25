import { z } from 'zod'
import { catalogIndex } from './catalog.ts'
import { decodeStorage, encodeStorage } from './catalog-storage.ts'
import { parsePlan } from './format.ts'
import { Conflict } from './errors.ts'
import { context } from './git.ts'
import { planRevision, readPlan, readStorageFiles, revision, withTransaction } from './repository.ts'
export const migrateCatalogSchema = z.strictObject({
  dryRun: z.boolean().default(true), expectedRevision: z.string().optional(), expectedContext: z.string().optional(),
})
const sortedKeys = (item: object) => Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? sortedKeys(item) : item)
export async function migrateCatalog(root: string, input: unknown) {
  const args = migrateCatalogSchema.parse(input)
  const plan = await readPlan(root)
  const before = await readStorageFiles(root)
  if (planRevision(decodeStorage(before), plan.repository) !== plan.revision) throw new Conflict('Catalog changed during migration preparation; repeat the dry run')
  const after = encodeStorage(plan.files, 'catalog-v1')
  const candidate = decodeStorage(after)
  const parsed = parsePlan(candidate.files)
  if (canonical(parsed) !== canonical(parsePlan(plan.files))) throw new Error('Migration changed the catalog projection')
  const entities = catalogIndex(plan)
  const counts = {
    documentsBefore: Object.keys(before).length, documentsAfter: Object.keys(after).length, entities: entities.length,
    relations: entities.reduce((sum, entity) => sum + entity.related.length, 0), assets: Object.keys(plan.assets).length,
  }
  const report = {
    from: plan.layout, to: 'catalog-v1', counts, validated: true, expectedRevision: plan.revision, expectedContext: plan.context.token,
    note: 'IDs, evidence, retained baselines and assets are preserved. This changes storage only; no source observation is refreshed.',
  }
  if (plan.layout === 'catalog-v1') return { ...report, status: 'already-migrated', revision: plan.revision }
  if (args.dryRun) return { ...report, status: 'dry-run' }
  if (args.expectedRevision !== plan.revision || args.expectedContext !== plan.context.token) {
    throw new Conflict('Apply migration with the current dry-run revision and context')
  }
  return withTransaction(root, async commit => {
    if ((await context(root)).token !== plan.context.token || revision(await readStorageFiles(root)) !== revision(before)) {
      throw new Conflict('Catalog changed before migration; repeat dry run')
    }
    await commit(before, after, plan.context.token)
    return { ...report, status: 'migrated', revision: planRevision(candidate, plan.repository) }
  })
}
