import { catalogCitations, type CatalogComponent } from '../shared/catalog-document.ts'
import { repositoryIdentity } from '../shared/repository-identity.ts'
import { InvalidInput } from './errors.ts'
import { context, git, gitRaw } from './git.ts'

/** Validate source pointers against the exact commit before publishing a catalog document. */
export async function verifyCatalogSource(root: string, repository: string, component: CatalogComponent) {
  const source = await context(root)
  if (repositoryIdentity(source.repository.id) !== repositoryIdentity(repository)) {
    throw new InvalidInput('sourceRoot is not a checkout of the selected repository')
  }
  const revision = await git(root, ['rev-parse', '--verify', `${component.sourceRevision}^{commit}`]).catch(() => null)
  if (revision !== component.sourceRevision) throw new InvalidInput('sourceRevision is not an available full commit SHA')
  const cache = new Map<string, string | null>()
  for (const citation of catalogCitations(component)) {
    if (!cache.has(citation.path)) {
      cache.set(citation.path, await gitRaw(root, ['show', `${revision}:${citation.path}`]).catch(() => null))
    }
    const content = cache.get(citation.path)
    if (content === null || content === undefined) throw new InvalidInput(`${citation.label}: source path is absent at the observed commit`)
    const range = /^([1-9]\d*)(?:-([1-9]\d*))?$/.exec(citation.lines)
    const start = range && Number(range[1]), end = range && Number(range[2] ?? range[1])
    const lineCount = content.length ? content.split(/\r?\n/).length - (/\r?\n$/.test(content) ? 1 : 0) : 0
    if (!start || !end || end < start || end > lineCount) {
      throw new InvalidInput(`${citation.label}: source line range does not exist at the observed commit`)
    }
  }
}
