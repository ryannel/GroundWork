import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
const exec = promisify(execFile)
export async function gitRaw(root: string, args: string[]) {
  return (await exec('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', root, ...args], { maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } })).stdout
}
export async function git(root: string, args: string[]) { return (await gitRaw(root, args)).trimEnd() }
export const digest = (text: string) => createHash('sha256').update(text).digest('hex')
export async function context(root: string) {
  root = await realpath(root)
  let branch: string | null = null, head: string | null = null, isGit = false
  try {
    await git(root, ['rev-parse', '--show-toplevel']); isGit = true
    branch = await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => null)
    head = await git(root, ['rev-parse', '--verify', 'HEAD']).catch(() => null)
  } catch { /* Uninitialised application folders are supported. */ }
  return { root, branch, head, isGit, checkoutId: digest(root).slice(0, 20), token: digest(JSON.stringify([root, branch, head])) }
}
export async function discover(root: string) {
  const ctx = await context(root)
  if (!ctx.isGit) return [ctx]
  const output = await git(root, ['worktree', 'list', '--porcelain', '-z'])
  const paths = output.split('\0').filter(line => line.startsWith('worktree ')).map(line => line.slice(9))
  return await Promise.all(paths.map(path => context(path)))
}
export async function activity(root: string) {
  const ctx = await context(root)
  if (!ctx.isGit) return { branches: [], changes: [], commits: [] }
  const branches = (await git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'])).split('\n').filter(Boolean)
  const changes = (await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=all'])).split('\0').filter(Boolean)
  const commits = await git(root, ['log', '-8', '--format=%h %s']).then(s => s.split('\n').filter(Boolean)).catch(() => [])
  return { branches, changes, commits }
}
export async function resolveRef(root: string, ref: string) {
  return await git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])
}
