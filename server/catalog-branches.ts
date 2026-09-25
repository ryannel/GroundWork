import { repositoryIdentity } from '../shared/repository-identity.ts'
import { InvalidInput } from './errors.ts'
import { NotInitialised } from './format.ts'
import { context, git } from './git.ts'
import { readCatalogTarget, readPlan } from './repository.ts'

export interface CatalogReadSource {
  repository: string
  branch: string | null
  commit: string | null
  workingTree: boolean
  label: string
}

/** A Hub comparison reads a local clone's committed default branch, never its feature-branch working tree. */
export async function localDefaultBranch(root: string): Promise<{ branch: string; ref: string; commit: string } | null> {
  const symbolic = await git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).catch(() => null)
  const candidates = [symbolic?.replace(/^origin\//, ''), 'main', 'master'].filter((name): name is string => !!name)
  for (const branch of [...new Set(candidates)]) {
    for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
      const commit = await git(root, ['rev-parse', '--verify', `${ref}^{commit}`]).catch(() => null)
      if (commit) return { branch, ref, commit }
    }
  }
  return null
}

/** The selected checkout is editable; every other repository is read at its local default-branch commit. */
export async function readProductCatalogPlan(root: string, editingRoot: string) {
  const ctx = await context(root)
  const editing = await context(editingRoot)
  const ownCheckout = ctx.checkoutId === editing.checkoutId
  const selected = ownCheckout ? null : await localDefaultBranch(root)
  if (!ownCheckout && !selected) throw new InvalidInput(`No committed default branch is available for ${ctx.repository.id}`)
  const plan = await readPlan(root, selected?.ref).catch(async error => {
    if (!(error instanceof NotInitialised)) throw error
    // A source repository may be cloned before its first shared catalog. It is still a valid empty candidate.
    const target = await readCatalogTarget(root, ctx.repository.id, 'source', selected?.ref)
    return { ...target.plan, repository: ctx.repository, context: target.context, files: target.files }
  })
  const readCommit = ownCheckout ? ctx.head : selected!.commit
  const source: CatalogReadSource = {
    repository: repositoryIdentity(ctx.repository.id),
    branch: ownCheckout ? ctx.branch : selected!.branch,
    commit: ownCheckout ? ctx.head : selected!.commit,
    workingTree: ownCheckout,
    label: `${repositoryIdentity(ctx.repository.id)}@${ownCheckout ? ctx.branch ?? 'detached' : selected!.branch}`
      + `${ownCheckout ? ' (working tree)' : ''}${readCommit ? ` ${readCommit.slice(0, 12)}` : ''}`,
  }
  return { plan, source }
}
