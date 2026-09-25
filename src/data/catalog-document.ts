import { z } from 'zod'
import { componentReadSchema } from './content-schema.ts'
import { repositoryIdentity } from './repository-identity.ts'
import { commitSha, isRepoRelativePath, isoTimestamp, text } from './schema-primitives.ts'
import { pathPatternCovers } from './content.ts'

const sourcePath = text.refine(value => value === '.' || isRepoRelativePath(value), 'Use a repository-relative source path')
const areas = ['dependencies', 'api', 'data', 'messaging', 'jobs', 'flows'] as const
export const catalogComponentSchema = componentReadSchema.extend({
  repo: text,
  sourceRevision: commitSha,
  observedAt: isoTimestamp,
  covers: z.array(sourcePath).min(1),
  areaGaps: z.strictObject(Object.fromEntries(areas.map(area => [area, z.array(text)])) as Record<typeof areas[number], z.ZodArray<typeof text>>),
})
export type CatalogComponent = z.infer<typeof catalogComponentSchema>
export interface CatalogCitation { label: string; path: string; lines: string; revision: string }

export function catalogCitations(component: CatalogComponent): CatalogCitation[] {
  const result: CatalogCitation[] = []
  const append = (entry: { evidence?: { path: string; lines: string; revision: string }[] }, label: string) => {
    for (const citation of entry.evidence ?? []) result.push({ label, ...citation })
  }
  append(component, `component ${component.id}`)
  for (const entry of component.api?.endpoints ?? []) append(entry, `endpoint ${entry.id}`)
  for (const entry of component.api?.schemas ?? []) append(entry, `schema ${entry.id}`)
  for (const entry of component.data?.records ?? []) append(entry, `data ${entry.id}`)
  for (const entry of component.messaging?.messages ?? []) append(entry, `message ${entry.id}`)
  for (const entry of component.jobs ?? []) append(entry, `job ${entry.id}`)
  for (const entry of component.unresolvedDependencies ?? []) append(entry, `unresolved dependency ${entry.name}`)
  for (const entry of component.findings ?? []) append(entry, `finding ${entry.id}`)
  for (const flow of component.executionFlows ?? []) {
    for (const step of flow.steps) append(step, `flow ${flow.id} step ${step.id}`)
    for (const transition of flow.transitions) append(transition, `flow ${flow.id} transition ${transition.id}`)
  }
  return result
}

/** A catalog entry is reviewable only when its source can be opened at the observation commit. */
export function catalogDocumentIssues(component: CatalogComponent, repository: string): string[] {
  const issues: string[] = []
  if (repositoryIdentity(component.repo) !== repositoryIdentity(repository)) issues.push('component.repo must match the selected repository')
  const citations = (entry: { evidence?: { path: string; lines: string; revision: string }[] }, label: string) => {
    if (!entry.evidence?.length) { issues.push(`${label}: add a source citation`); return }
    for (const citation of entry.evidence) {
      if (!isRepoRelativePath(citation.path)) issues.push(`${label}: citation path must be repository-relative`)
      if (!/^[1-9]\d*(?:-[1-9]\d*)?$/.test(citation.lines)) issues.push(`${label}: cite a line or inclusive line range`)
      if (citation.revision !== component.sourceRevision) issues.push(`${label}: citation revision must equal sourceRevision`)
      if (!component.covers.some(cover => pathPatternCovers(cover, citation.path))) issues.push(`${label}: citation path is outside covers`)
    }
  }
  citations(component, `component ${component.id}`)
  for (const entry of component.api?.endpoints ?? []) citations(entry, `endpoint ${entry.id}`)
  for (const entry of component.api?.schemas ?? []) citations(entry, `schema ${entry.id}`)
  for (const entry of component.data?.records ?? []) citations(entry, `data ${entry.id}`)
  for (const entry of component.messaging?.messages ?? []) citations(entry, `message ${entry.id}`)
  for (const entry of component.jobs ?? []) citations(entry, `job ${entry.id}`)
  for (const entry of component.unresolvedDependencies ?? []) citations(entry, `unresolved dependency ${entry.name}`)
  for (const entry of component.findings ?? []) citations(entry, `finding ${entry.id}`)
  for (const flow of component.executionFlows ?? []) {
    for (const step of flow.steps) citations(step, `flow ${flow.id} step ${step.id}`)
    for (const transition of flow.transitions) citations(transition, `flow ${flow.id} transition ${transition.id}`)
  }
  return issues
}
