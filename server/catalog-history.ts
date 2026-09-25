import { digest, git, gitRaw } from './git.ts'
import type { Observation, RevisionHistory } from './catalog-resolution.ts'

const sha = /^[0-9a-f]{40,64}$/i
const relationKey = (a: string, b: string) => JSON.stringify([a, b])
const treeKey = (tree: NonNullable<Observation['tree']>) => JSON.stringify([tree.id, tree.coveredPathsKey])

function pathsFromKey(key: string): string[] {
  const value: unknown = JSON.parse(key)
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string'
    || !item || item.startsWith('/') || item.split('/').some(segment => !segment || segment === '.' || segment === '..')
    || item.includes('\0'))) throw new Error('Invalid covered paths key')
  return value as string[]
}

/** Scan provenance names the exact tracked paths examined, independent of their list order. */
export function coveredPathsKey(paths: string[]) {
  return JSON.stringify([...new Set(paths)].sort())
}

/** Content identity of the covered tracked paths, so a squash merge can match without equal commit IDs. */
export async function coveredTreeId(root: string, revision: string, paths: string[]) {
  if (!sha.test(revision)) throw new Error('Covered tree requires a pinned commit')
  const selected = pathsFromKey(coveredPathsKey(paths))
  const output = await gitRaw(root, ['ls-tree', '-r', '-z', '--full-tree', revision, '--', ...selected])
  const records = output.split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t')
    if (tab < 0) throw new Error('Invalid Git tree entry')
    return `${record.slice(tab + 1)}\0${record.slice(0, tab)}`
  }).sort()
  return digest(records.join('\0'))
}

async function isAncestor(root: string, first: string, second: string): Promise<boolean | null> {
  try { await git(root, ['merge-base', '--is-ancestor', first, second]); return true }
  catch (error) {
    return 'stderr' in (error as object) && !(error as { stderr: string }).stderr.trim() ? false : null
  }
}

/** Precompute the graph and covered-path tree matches used by the synchronous, pure resolver. */
export async function buildRevisionHistory(root: string, revisions: (string | null | undefined)[], trees: NonNullable<Observation['tree']>[],
  defaultRef?: string | null): Promise<RevisionHistory> {
  const equivalent = new Map<string, string>()
  const head = defaultRef ? await git(root, ['rev-parse', '--verify', `${defaultRef}^{commit}`]).catch(() => null) : null
  if (head) for (const tree of trees) {
    const paths = pathsFromKey(tree.coveredPathsKey)
    const changed = await git(root, ['log', '--format=%H', head, '--', ...paths]).catch(() => '')
    for (const commit of [head, ...changed.split('\n').filter(Boolean)]) {
      if (await coveredTreeId(root, commit, paths).catch(() => null) === tree.id) {
        equivalent.set(treeKey(tree), commit)
        break
      }
    }
  }
  const commits = [...new Set([...revisions, ...equivalent.values()].filter((revision): revision is string =>
    typeof revision === 'string' && sha.test(revision)))]
  const shallow = await git(root, ['rev-parse', '--is-shallow-repository']).then(value => value === 'true', () => true)
  const present = new Set<string>()
  for (const commit of commits) if (await git(root, ['cat-file', '-e', `${commit}^{commit}`]).then(() => true, () => false)) present.add(commit)
  const relations = new Map<string, ReturnType<RevisionHistory['relation']>>()
  for (const first of commits) for (const second of commits) {
    let order: ReturnType<RevisionHistory['relation']> = 'unknown'
    if (present.has(first) && present.has(second)) {
      if (first === second) order = 'same'
      else {
        const forward = await isAncestor(root, first, second)
        const reverse = await isAncestor(root, second, first)
        order = forward === true ? 'ancestor' : reverse === true ? 'descendant'
          : forward === false && reverse === false && !shallow ? 'diverged' : 'unknown'
      }
    }
    relations.set(relationKey(first, second), order)
  }
  return {
    relation: (first, second) => first === second && present.has(first) ? 'same'
      : relations.get(relationKey(first, second)) ?? 'unknown',
    defaultBranchRevision: tree => equivalent.get(treeKey(tree)),
  }
}
