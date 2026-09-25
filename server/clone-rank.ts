import { git } from './git.ts'

export interface CloneCandidate { root: string; checkoutId: string; repository: string }
export interface CloneDisagreement {
  status: 'different' | 'diverged' | 'unknown'
  heads: { root: string; head: string | null }[]
}
export interface CloneSelection { preferredCheckoutId: string; disagreement: CloneDisagreement | null }

async function defaultBranchHead(root: string) {
  const symbolic = await git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).catch(() => null)
  const defaultName = symbolic?.slice('origin/'.length) ?? 'main'
  const head = await git(root, ['rev-parse', '--verify', `refs/heads/${defaultName}`]).catch(() => null)
    ?? await git(root, ['rev-parse', '--verify', 'refs/heads/main']).catch(() => null)
    ?? await git(root, ['rev-parse', '--verify', 'refs/heads/master']).catch(() => null)
    ?? await git(root, ['rev-parse', '--verify', 'HEAD']).catch(() => null)
  const history = head ? Number(await git(root, ['rev-list', '--count', head]).catch(() => '0')) : 0
  return { head, history }
}

type Relation = 'equal' | 'before' | 'after' | 'diverged' | 'unknown'
async function relation(a: { root: string; head: string | null }, b: { root: string; head: string | null }): Promise<Relation> {
  if (!a.head || !b.head) return 'unknown'
  if (a.head === b.head) return 'equal'
  for (const root of [a.root, b.root]) {
    const hasBoth = await Promise.all([a.head, b.head].map(head =>
      git(root, ['cat-file', '-e', `${head}^{commit}`]).then(() => true, () => false)))
    if (!hasBoth.every(Boolean)) continue
    if (await git(root, ['merge-base', '--is-ancestor', a.head, b.head]).then(() => true, () => false)) return 'before'
    if (await git(root, ['merge-base', '--is-ancestor', b.head, a.head]).then(() => true, () => false)) return 'after'
    return 'diverged'
  }
  return 'unknown'
}

/** Compare local default branches without fetching or using worktree feature-branch HEADs. */
export async function rankClones(candidates: CloneCandidate[]): Promise<Map<string, CloneSelection>> {
  const groups = new Map<string, CloneCandidate[]>()
  for (const candidate of candidates) groups.set(candidate.repository,
    [...(groups.get(candidate.repository) ?? []), candidate])
  const result = new Map<string, CloneSelection>()
  for (const [repository, group] of groups) {
    const clones = await Promise.all(group.map(async clone => ({ ...clone, ...await defaultBranchHead(clone.root) })))
    clones.sort((a, b) => a.root.localeCompare(b.root))
    let best = clones[0]
    let disagreement: CloneDisagreement['status'] | null = null
    for (const clone of clones.slice(1)) {
      const order = await relation(best, clone)
      if (order !== 'equal') {
        disagreement = order === 'diverged' ? 'diverged'
          : order === 'unknown' && disagreement !== 'diverged' ? 'unknown' : disagreement ?? 'different'
      }
      if (order === 'before' || (order === 'diverged' || order === 'unknown') && clone.history > best.history) best = clone
    }
    result.set(repository, {
      preferredCheckoutId: best.checkoutId,
      disagreement: disagreement ? { status: disagreement, heads: clones.map(({ root, head }) => ({ root, head })) } : null,
    })
  }
  return result
}
