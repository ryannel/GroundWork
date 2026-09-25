import path from 'node:path'
import { realpath } from 'node:fs/promises'
import { z } from 'zod'
import { deriveRepositoryIdentity, repositoryIdentity } from '../src/data/repository-identity.ts'
import { isRepoRelativePath } from '../src/data/schema-primitives.ts'
import { catalogIndex } from './catalog.ts'
import { sourceObservation, type SourceObservation } from '../src/data/catalog-index.ts'
import { InvalidInput, NotFound } from './errors.ts'
import { git, gitRaw, originUrl, resolveRef } from './git.ts'
import { readPlan } from './repository.ts'

export const checkCatalogFreshnessSchema = z.strictObject({
  repository: z.string().min(1).optional(), repositoryPath: z.string().min(1), targetRef: z.string().min(1).max(500),
  ids: z.array(z.string().min(1).max(2000)).min(1).max(20),
  maxFiles: z.number().int().min(0).max(200).default(50),
  maxBytes: z.number().int().min(8192).max(65536).default(32768),
})

/**
 * Comparison key for a repository: the shared identity. A local path is not an identity, so a checkout is resolved
 * through symlinks and then through its own origin, exactly as acquisition and `context()` derive it.
 */
export async function repositoryKey(value: string) {
  if (!path.isAbsolute(value)) return repositoryIdentity(value)
  const root = await realpath(value).catch(() => value)
  return deriveRepositoryIdentity(await originUrl(root).catch(() => null), root).id
}

/** Freshness statuses from least to most severe. Aggregates always report the most severe status. */
export const freshnessSeverity = {
  unchecked: 0, 'unchanged-source-tree': 1, 'impact-unknown': 2, 'review-required': 3, unknown: 4,
} as const
export type FreshnessStatus = keyof typeof freshnessSeverity
export function worstStatus<T extends FreshnessStatus>(statuses: Iterable<T>, fallback: T): T {
  let worst = fallback
  for (const status of statuses) if (freshnessSeverity[status] > freshnessSeverity[worst]) worst = status
  return worst
}

type ComparedStatus = Exclude<FreshnessStatus, 'unchecked'>
/** What to inspect next for each outcome of a source comparison. */
const nextInspection: Record<ComparedStatus, string> = {
  unknown: 'Make observed history available and repeat the check.',
  'review-required': 'Inspect changed citations, configuration/dependency changes and source ancestry before reusing the observation.',
  'impact-unknown': 'Review uncited changes and check other recorded repositories separately before deciding whether this observation can be reused.',
  'unchanged-source-tree': 'The compared repository trees match. External dependencies, deployed settings and behavioral correctness remain unverified.',
}

/** Number of lines in a text file; a trailing newline ends the last line rather than starting another. */
export function lineCount(text: string) {
  if (!text.length) return 0
  return text.split(/\r?\n/).length - (/\r?\n$/.test(text) ? 1 : 0)
}

type Citation = { path: string; revision: string; lines?: string; repository?: string }
function citations(value: unknown, fallback: string | null, result: Citation[] = [], repository?: string): Citation[] {
  if (Array.isArray(value)) { for (const item of value) citations(item, fallback, result, repository); return result }
  if (!value || typeof value !== 'object') return result
  const record = value as Record<string, unknown>
  repository = typeof record.repository === 'string' ? record.repository : repository
  const revision = typeof record.sourceRevision === 'string' ? record.sourceRevision : fallback
  if (typeof record.source === 'string' && revision) result.push({ path: record.source, revision, repository })
  for (const [key, child] of Object.entries(record)) {
    if (key === 'evidence' && Array.isArray(child)) for (const evidence of child) {
      if (!evidence || typeof evidence.path !== 'string' || typeof evidence.revision !== 'string') continue
      result.push({ path: evidence.path, revision: evidence.revision, lines: evidence.lines, repository: evidence.repository ?? repository })
    } else if (key !== 'evidence') citations(child, revision, result, repository)
  }
  return result
}
/** File names whose change can alter behaviour outside the cited paths: lockfiles, manifests, configuration and startup. */
const BROADER_CHANGE_NAMES = [
  '[^/]*lock[^/]*', 'package\\.json', '[^/]*\\.csproj', 'Directory\\.[^/]+', 'appsettings[^/]*', '[^/]*config[^/]*',
  '[^/]*migration[^/]*', 'Startup\\.[^/]+', 'Program\\.[^/]+', '[^/]*DependencyInjection[^/]*',
]
const broaderChangePattern = new RegExp(`(?:^|/)(?:${BROADER_CHANGE_NAMES.join('|')})$`, 'i')
export const broaderChange = (file: string) => broaderChangePattern.test(file)

/** Explicit, local, read-only Git comparison. It never fetches or treats citations as a complete dependency graph. */
export async function checkCatalogFreshness(root: string, input: unknown, ref?: string) {
  return compareCatalogSources(await readPlan(root, ref), input)
}
export async function compareCatalogSources(
  plan: Awaited<ReturnType<typeof readPlan>>, input: unknown, observations: SourceObservation[] = catalogIndex(plan).map(sourceObservation),
) {
  const args = checkCatalogFreshnessSchema.parse(input)
  if (new Set(args.ids).size !== args.ids.length) throw new InvalidInput('Duplicate freshness IDs')
  const selected = args.ids.map(id => {
    const observation = observations.find(item => item.id === id)
    if (!observation) throw new NotFound(`Unknown catalog entity: ${id}`)
    return observation
  })
  const repositories = new Set(await Promise.all(selected.map(async observation => {
    const repo = args.repository ?? observation.repository
    return repo ? repositoryKey(repo) : undefined
  })))
  if (repositories.size !== 1 || repositories.has(undefined)) throw new InvalidInput('Select entities with one known source repository per check')
  const repository = [...repositories][0]!
  if (args.repository) for (const observation of selected) {
    const pointers = citations(observation.raw, observation.sourceRevision, [], observation.repository ?? undefined)
    const known = [observation.repository, ...pointers.map(pointer => pointer.repository)].filter((value): value is string => !!value)
    if (!(await Promise.all(known.map(repositoryKey))).includes(repository)) throw new InvalidInput('Selected repository is not recorded for this observation')
  }
  const envelope = {
    version: 1, catalogRevision: plan.revision, context: plan.context.token,
    checkedAt: new Date().toISOString(), repository, requestedTarget: args.targetRef,
    method: 'Immutable commit tree comparison; renames conservatively reported as deletion plus addition.',
    scope: 'Entire source repository diff for each cited/observed revision; evidence paths map only known impact. '
      + 'Working-tree changes and remote/deployed behavior are excluded.',
    behavioralVerification: 'not-performed', persisted: false,
    limitations: [
      'Citations are not a complete dependency graph.',
      'No remote fetch is performed; an available local target may lag its remote.',
      'This check does not rewrite observations, mark the catalog current, or change a feature baseline.',
    ],
  }
  let source: string, target: string
  try {
    source = await realpath(args.repositoryPath)
    const top = await realpath(await git(source, ['rev-parse', '--show-toplevel']))
    if (source !== top) throw new Error('repositoryPath must identify the source repository root')
    if (await repositoryKey(source) !== repository && repositoryIdentity(source) !== repository) {
      throw new Error('Source repository identity does not match the selected catalog entities')
    }
    target = await resolveRef(source, args.targetRef)
  } catch (error) {
    const nextInspection = 'Provide a matching local repository with the observed commits and requested target available; '
      + 'fetch explicitly if required.'
    const reason = String((error as Error).message).slice(0, 1000)
    return { ...envelope, status: 'unknown', targetRevision: null, reason, nextInspection, assessments: [] }
  }
  const comparisons = new Map<string, Promise<{ available: boolean; files: string[]; ancestry: string }>>()
  const compare = (base: string) => {
    if (!comparisons.has(base)) comparisons.set(base, (async () => {
      if (!/^[a-f0-9]{40,64}$/.test(base)) return { available: false, files: [], ancestry: 'unknown' }
      try {
        const observed = await resolveRef(source, base)
        const diff = await gitRaw(source, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', observed, target, '--'])
        const files = diff.split('\0').filter(Boolean)
        const ancestry = observed === target
          ? 'same-commit'
          : await git(source, ['merge-base', '--is-ancestor', observed, target]).then(() => 'descendant', () => 'not-known-to-be-descendant')
        return { available: true, files, ancestry }
      } catch { return { available: false, files: [], ancestry: 'unknown' } }
    })())
    return comparisons.get(base)!
  }
  const blobCache = new Map<string, Promise<string | null>>()
  const blob = (revision: string, file: string) => {
    const key = `${revision}:${file}`
    if (!blobCache.has(key)) blobCache.set(key, gitRaw(source, ['show', key]).catch(() => null))
    return blobCache.get(key)!
  }
  const assessments = []
  for (const entity of selected) {
    const primary = entity.repository ? await repositoryKey(entity.repository) : null
    const observedRevision = primary === repository ? entity.sourceRevision : null
    const allPointers = await Promise.all(citations(entity.raw, entity.sourceRevision, [], entity.repository ?? undefined)
      .map(async pointer => ({ ...pointer, repository: pointer.repository ? await repositoryKey(pointer.repository) : primary })))
    const cited = [primary, ...allPointers.map(pointer => pointer.repository)]
    const otherRepositories = [...new Set(cited.filter((value): value is string => !!value && value !== repository))]
    const pointers = allPointers.filter(pointer => pointer.repository === repository)
    const unique = [...new Map(pointers.map(pointer => [JSON.stringify(pointer), pointer])).values()]
    const revisions = [...new Set([observedRevision, ...unique.map(pointer => pointer.revision)].filter((revision): revision is string => !!revision))]
    let missingHistory = !revisions.length, changedRepository = false, divergence = false
    const changedKnown = new Set<string>(), unknownPaths = new Set<string>(), broad = new Set<string>()
    const invalidCitations: string[] = []
    for (const base of revisions) {
      const comparison = await compare(base)
      missingHistory ||= !comparison.available
      changedRepository ||= comparison.files.length > 0
      divergence ||= comparison.ancestry === 'not-known-to-be-descendant'
      const known = new Set(unique.filter(pointer => pointer.revision === base).map(pointer => pointer.path))
      for (const file of comparison.files) {
        if (known.has(file)) changedKnown.add(file); else unknownPaths.add(file)
        if (broaderChange(file)) broad.add(file)
      }
    }
    for (const pointer of unique) {
      if (!isRepoRelativePath(pointer.path) || !/^[a-f0-9]{40,64}$/.test(pointer.revision)) { invalidCitations.push(pointer.path); continue }
      if (!(await compare(pointer.revision)).available) continue
      const content = await blob(pointer.revision, pointer.path)
      const range = pointer.lines && /^([1-9]\d*)(?:-([1-9]\d*))?$/.exec(pointer.lines)
      const [start, end] = range ? [Number(range[1]), Number(range[2] ?? range[1])] : [0, 0]
      if (content === null || (pointer.lines && (!range || end < start || end > lineCount(content)))) invalidCitations.push(pointer.path)
    }
    const status = worstStatus<ComparedStatus>([
      ...(missingHistory ? ['unknown' as const] : []),
      ...(invalidCitations.length || changedKnown.size || broad.size || divergence ? ['review-required' as const] : []),
      ...(changedRepository || otherRepositories.length ? ['impact-unknown' as const] : []),
    ], 'unchanged-source-tree')
    assessments.push({
      id: entity.id, observedRevision, status, otherRepositories: otherRepositories.slice(0, 10), otherRepositoryCount: otherRepositories.length,
      citationIntegrity: missingHistory ? 'unknown' : invalidCitations.length ? 'invalid' : unique.length ? 'checked-at-observation' : 'no-citations',
      knownImpact: { changed: changedKnown.size, paths: [...changedKnown].sort().slice(0, 10) },
      unmappedChanges: unknownPaths.size, broaderReviewChanges: { count: broad.size, paths: [...broad].sort().slice(0, 10) },
      invalidCitations: { count: invalidCitations.length, paths: invalidCitations.slice(0, 10) },
      ancestry: divergence ? 'not-known-to-be-descendant' : missingHistory ? 'unknown' : 'same-or-descendant',
      nextInspection: nextInspection[status],
    })
  }
  let remaining = args.maxFiles
  const changes = []
  for (const [base, pending] of comparisons) {
    const comparison = await pending
    const files = comparison.files.slice(0, remaining); remaining -= files.length
    changes.push({
      observedRevision: base, available: comparison.available, ancestry: comparison.ancestry,
      totalChangedFiles: comparison.files.length, files, omittedFiles: comparison.files.length - files.length,
    })
  }
  const result = {
    ...envelope, targetRevision: target, status: worstStatus(assessments.map(item => item.status), 'unchanged-source-tree'), assessments, changes,
    limits: { maxFiles: args.maxFiles, maxBytes: args.maxBytes },
    detail: 'Counts cover the full comparison. Omitted filenames can be inspected with '
      + 'git diff --no-renames --name-only <observedRevision> <targetRevision> -- in the identified source repository.',
  }
  while (Buffer.byteLength(JSON.stringify(result)) > args.maxBytes) {
    const change = [...changes].reverse().find(change => change.files.length)
    if (change) { change.files.pop(); change.omittedFiles++; continue }
    const detail = assessments
      .flatMap(item => [item.knownImpact.paths, item.broaderReviewChanges.paths, item.invalidCitations.paths])
      .find(paths => paths.length)
    if (detail) { detail.pop(); continue }
    throw new InvalidInput('Freshness envelope exceeds maxBytes; select fewer entities or increase the limit')
  }
  return result
}
