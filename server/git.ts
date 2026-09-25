import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { NotFound } from './errors.ts'
import { deriveRepositoryIdentity } from '../src/data/repository-identity.ts'
const exec = promisify(execFile)
/** A failed git invocation with a short message; the full stderr stays available for diagnosis. */
export class GitError extends Error {
  readonly args: string[]
  readonly stderr: string
  constructor(args: string[], stderr: string, options?: ErrorOptions) {
    const detail = stderr.split('\n').map(line => line.replace(/^(?:fatal|error): /, '').trim()).find(Boolean)
    super(`git ${args[0] ?? ''} failed${detail ? `: ${detail}` : ''}`, options)
    this.args = args
    this.stderr = stderr
  }
}
/** Runs git with hooks, fsmonitor, optional locks and prompts disabled; failures become a GitError. */
async function run(root: string, args: string[], options: { encoding: 'utf8' | 'buffer'; maxBuffer: number }): Promise<string | Buffer> {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
  try {
    return (await exec('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', root, ...args], { ...options, env })).stdout
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error
    throw new GitError(args, String((error as { stderr?: unknown }).stderr ?? ''), { cause: error })
  }
}
export async function gitRaw(root: string, args: string[]) {
  return await run(root, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }) as string
}
/** Binary output, such as a blob, through the same hardened invocation as gitRaw. */
export async function gitBuffer(root: string, args: string[], { maxBuffer }: { maxBuffer: number }) {
  return await run(root, args, { encoding: 'buffer', maxBuffer }) as Buffer
}
export async function git(root: string, args: string[]) { return (await gitRaw(root, args)).trimEnd() }
export const digest = (text: string) => createHash('sha256').update(text).digest('hex')
/**
 * Reads every configured `origin` URL, in order. `git config --get` reports the *last* value, while a remote with
 * several URLs fetches from the *first*; `git remote get-url` would report the first but also apply this machine's
 * `url.*.insteadOf` rewrites, so a teammate's clone would derive a different identity for the same repository.
 */
export const ORIGIN_URL_ARGS = ['config', '--get-all', 'remote.origin.url']
/** The fetch URL among the values `ORIGIN_URL_ARGS` prints: the first one. */
export const firstOriginUrl = (output: string) => output.split('\n').map(line => line.trim()).find(Boolean) ?? null
/** The `origin` URL Git fetches from, or null when the clone has none. Other remotes are never consulted. */
export async function originUrl(root: string): Promise<string | null> {
  return firstOriginUrl(await gitRaw(root, ORIGIN_URL_ARGS).catch(() => ''))
}
export async function context(root: string) {
  root = await realpath(root)
  let branch: string | null = null, head: string | null = null, isGit = false
  try {
    // One process for the common case: a repository with at least one commit.
    const [, sha, symbolic] = (await git(root, ['rev-parse', '--show-toplevel', 'HEAD', '--symbolic-full-name', 'HEAD'])).split('\n')
    isGit = true
    head = sha
    branch = symbolic?.startsWith('refs/heads/') ? symbolic.slice('refs/heads/'.length) : null
  } catch {
    try {
      await git(root, ['rev-parse', '--show-toplevel']); isGit = true
      branch = await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => null)
      head = await git(root, ['rev-parse', '--verify', 'HEAD']).catch(() => null)
    } catch { /* Uninitialised application folders are supported. */ }
  }
  // The checkout ID stays a digest of the path: it names this clone, while the repository identity names the repository.
  const repository = deriveRepositoryIdentity(isGit ? await originUrl(root) : null, root)
  return { root, branch, head, isGit, repository, checkoutId: digest(root).slice(0, 20), token: digest(JSON.stringify([root, branch, head])) }
}
/** Every worktree of the repository at `root`. Worktrees whose directory has gone (prunable) are skipped. */
export async function discover(root: string) {
  const ctx = await context(root)
  if (!ctx.isGit) return [ctx]
  const output = await git(root, ['worktree', 'list', '--porcelain', '-z'])
  const paths = output.split('\0').filter(line => line.startsWith('worktree ')).map(line => line.slice(9))
  const settled = await Promise.allSettled(paths.map(path => context(path)))
  return settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
}
export async function activity(root: string) {
  const ctx = await context(root)
  if (!ctx.isGit) return { branches: [], changes: [], commits: [] }
  const branches = (await git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'])).split('\n').filter(Boolean)
  const changes = (await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=all'])).split('\0').filter(Boolean)
  const commits = await git(root, ['log', '-8', '--format=%h %s']).then(s => s.split('\n').filter(Boolean)).catch(() => [])
  return { branches, changes, commits }
}
/** Resolves a ref to a commit SHA; an unknown ref is NotFound. */
export async function resolveRef(root: string, ref: string) {
  try {
    return await git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])
  } catch (error) {
    if (error instanceof GitError) throw new NotFound(`Unknown ref: ${ref}`, { cause: error })
    throw error
  }
}
