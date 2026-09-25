import { z } from 'zod'
import { catalogCitations, catalogComponentSchema } from '../src/data/catalog-document.ts'
import { pathPatternCovers } from '../src/data/content.ts'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import { InvalidInput } from './errors.ts'
import { context, git, gitRaw, resolveRef } from './git.ts'
import { readCatalogTarget } from './repository.ts'

export const catalogFreshnessSchema = z.strictObject({
  repository: z.string().min(1), destination: z.enum(['source', 'local']).default('source'),
  sourceRoot: z.string().min(1), targetRef: z.string().min(1).default('HEAD'),
})

/** Compare catalog observations with a local commit. This is a source change list, not a claim of runtime correctness. */
export async function checkCatalogFreshness(root: string, input: unknown, ref?: string) {
  const args = catalogFreshnessSchema.parse(input)
  const source = await context(args.sourceRoot)
  const repository = repositoryIdentity(args.repository)
  if (repositoryIdentity(source.repository.id) !== repository) throw new InvalidInput('sourceRoot is not the selected repository')
  const target = await resolveRef(args.sourceRoot, args.targetRef)
  const catalog = await readCatalogTarget(root, repository, args.destination, ref)
  const components = catalog.plan.snapshot.components
    .filter(component => repositoryIdentity(component.repo ?? repository) === repository)
  const allChanged = new Set<string>()
  const assessments = []
  for (const component of components) {
    const parsed = catalogComponentSchema.safeParse(component)
    if (!parsed.success) {
      assessments.push({ componentId: component.id, status: 'unknown', reason: 'Catalog document lacks source commit, coverage or area gaps',
        changedCitations: [], changedCoveredFiles: [], gaps: null })
      continue
    }
    const document = parsed.data
    const exists = await git(args.sourceRoot, ['rev-parse', '--verify', `${document.sourceRevision}^{commit}`]).catch(() => null)
    if (exists !== document.sourceRevision) {
      assessments.push({ componentId: document.id, status: 'unknown', reason: 'Observed commit is unavailable in the local clone',
        changedCitations: [], changedCoveredFiles: [], gaps: document.areaGaps })
      continue
    }
    const changed = (await gitRaw(args.sourceRoot, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z',
      document.sourceRevision, target, '--'])).split('\0').filter(file => !!file && !file.startsWith('.groundwork/'))
    for (const file of changed) allChanged.add(file)
    const cited = new Set(catalogCitations(document).map(item => item.path))
    const covered = (file: string) => document.covers.some(pattern => pathPatternCovers(pattern, file))
    const changedCitations = changed.filter(file => cited.has(file)).sort()
    const changedCoveredFiles = changed.filter(file => covered(file) && !cited.has(file)).sort()
    assessments.push({ componentId: document.id, observedRevision: document.sourceRevision,
      observedAt: document.observedAt, status: changedCitations.length || changedCoveredFiles.length ? 'review-required' : 'current',
      changedCitations, changedCoveredFiles, gaps: document.areaGaps })
  }
  const covers = components.flatMap(component => {
    const parsed = catalogComponentSchema.safeParse(component)
    return parsed.success ? parsed.data.covers : []
  })
  const uncataloguedFiles = [...allChanged].filter(file => !covers.some(pattern => pathPatternCovers(pattern, file))).sort()
  return { repository, destination: args.destination, catalogRevision: catalog.revision, targetRevision: target,
    assessments, uncataloguedFiles, checkedAt: new Date().toISOString(),
    status: assessments.some(item => item.status === 'unknown') ? 'unknown'
      : assessments.some(item => item.status === 'review-required') || uncataloguedFiles.length ? 'review-required' : 'current',
    scope: 'Committed Git file changes only; working-tree edits and runtime behavior are not verified.' }
}
