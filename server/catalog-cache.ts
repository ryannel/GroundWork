import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { hasCredentials, repositoryIdentity } from '../src/data/repository-identity.ts'
import { InvalidInput } from './errors.ts'
import { digest } from './git.ts'
import { NotInitialised } from './format.ts'
import { atomicFile, readPlan, safePath, withLock } from './repository.ts'
import { readonlyTree } from './scan-workspace.ts'
import { run } from './scan-acquire.ts'

const objectId = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
const generation = z.string().uuid()
const recordedCommitSchema = z.strictObject({ revision: objectId, available: z.boolean() })
const cacheStatusSchema = z.strictObject({
  version: z.literal(1),
  generation,
  repository: z.string().min(1),
  status: z.enum(['ready', 'missing']),
  defaultBranch: z.string().min(1),
  defaultCommit: objectId,
  fetchedAt: z.iso.datetime(),
  source: z.literal('hub-cache'),
  sourceLabel: z.string().min(1),
  trust: z.literal('untrusted'),
  recordedCommits: z.array(recordedCommitSchema),
})

export type CatalogCacheStatus = z.infer<typeof cacheStatusSchema>
export interface CatalogCacheEntry extends Omit<CatalogCacheStatus, 'generation' | 'defaultCommit'> {
  /** A non-bare Git repository with no checked-out files. */
  root: string
  /** The fetched default-branch commit. Pass this and `root` to readPlan(root, ref). */
  ref: string
}
export interface CatalogCacheRequest {
  repository: string
  remote: string
  /** Full object IDs cited by candidate catalogs. Fetch failures are reported without failing the refresh. */
  recordedCommits?: string[]
}
export interface CatalogCacheOptions {
  cacheRoot?: string
  now?: () => Date
  /** Offline fixtures may use a bare local remote with no origin from which to verify the requested identity. */
  allowUnverifiedLocalRemote?: boolean
}

const MAX_RECORDED_COMMITS = 100
const githubShorthand = /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/
const gitUrl = /^(?:https?:\/\/|ssh:\/\/|git@)/

/** The per-user Hub cache. Tests and embedders can override it without changing GROUNDWORK_HOME. */
export function catalogCacheRoot(configRoot = path.resolve(process.env.GROUNDWORK_HOME ?? path.join(homedir(), '.config', 'groundwork-v2'))) {
  return path.join(configRoot, 'catalog-cache')
}

async function ensureOwnedDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const info = await lstat(directory)
  const uid = process.getuid?.()
  if (!info.isDirectory() || info.isSymbolicLink() || (uid !== undefined && info.uid !== uid)) {
    throw new InvalidInput(`${directory} must be a directory owned by the current user`)
  }
  await chmod(directory, 0o700)
  return realpath(directory)
}

async function makeWritable(target: string) {
  const info = await lstat(target).catch(() => null)
  if (!info) return
  if (info.isDirectory()) {
    await chmod(target, 0o700)
    for (const name of await readdir(target)) await makeWritable(path.join(target, name))
  } else if (info.isFile()) await chmod(target, 0o600)
}

async function removeTree(target: string) {
  await makeWritable(target)
  await rm(target, { recursive: true, force: true })
}

async function git(root: string, args: string[]) {
  return (await run('git', ['-C', root, ...args])).toString('utf8').trimEnd()
}

async function safeRemote(remote: string) {
  if (!remote.trim() || remote !== remote.trim() || /[\0\r\n]/.test(remote) || remote.startsWith('-')) {
    throw new InvalidInput('Repository remote must be a non-empty Git URL or local path')
  }
  if (hasCredentials(remote)) {
    throw new InvalidInput('Remove credentials from the repository URL; use a Git credential helper instead')
  }
  const local = await realpath(remote).catch(() => null)
  if (local) return { url: local, local }
  if (githubShorthand.test(remote)) return { url: `https://github.com/${remote}.git`, local: null }
  if (gitUrl.test(remote)) return { url: remote, local: null }
  throw new InvalidInput('Repository remote must be an existing local path, owner/name, or HTTP/SSH Git URL')
}

function parseDefaultHead(output: string) {
  const symbolic = output.split('\n').find(line => line.startsWith('ref: ') && line.endsWith('\tHEAD'))
  const match = symbolic && /^ref: refs\/heads\/(.+)\tHEAD$/.exec(symbolic)
  const commit = output.split('\n').map(line => line.split('\t'))
    .find(([candidate, ref]) => ref === 'HEAD' && objectId.safeParse(candidate).success)?.[0]
  if (!match || !commit || !objectId.safeParse(commit).success) {
    throw new InvalidInput('Repository does not advertise a valid symbolic default branch')
  }
  return { branch: match[1], commit }
}

async function verifyRemoteIdentity(repository: string, remote: Awaited<ReturnType<typeof safeRemote>>, allowUnverifiedLocal: boolean) {
  if (!remote.local) {
    if (repositoryIdentity(remote.url) !== repository) {
      throw new InvalidInput(`Repository remote identifies ${repositoryIdentity(remote.url)}, not ${repository}`)
    }
    return
  }
  if (allowUnverifiedLocal) return
  const configured = await run('git', ['-C', remote.local, 'config', '--get-all', 'remote.origin.url'])
    .then(output => output.toString('utf8').split('\n').map(line => line.trim()).find(Boolean) ?? null, () => null)
  if (configured) {
    if (repositoryIdentity(configured) !== repository) {
      throw new InvalidInput(`Local repository origin identifies ${repositoryIdentity(configured)}, not ${repository}`)
    }
    return
  }
  throw new InvalidInput('A local bare remote without an origin cannot be bound to a repository identity; use a verified network remote')
}

function normaliseRequest(request: CatalogCacheRequest) {
  const repository = repositoryIdentity(request.repository)
  if (!repository || /[\0\r\n]/.test(repository)) throw new InvalidInput('Repository identity is required')
  const requested = request.recordedCommits ?? []
  if (requested.length > MAX_RECORDED_COMMITS) throw new InvalidInput(`At most ${MAX_RECORDED_COMMITS} recorded commits can be fetched at once`)
  const parsed = requested.map(value => objectId.parse(value.toLowerCase()))
  return { repository, recordedCommits: [...new Set(parsed)] }
}

async function validateNoCheckout(root: string) {
  const names = await readdir(root)
  if (names.length !== 1 || names[0] !== '.git') throw new InvalidInput('Hub catalog cache unexpectedly materialised repository source files')
}

async function validateCatalog(root: string, ref: string): Promise<'ready' | 'missing'> {
  try {
    await readPlan(root, ref)
    return 'ready'
  } catch (error) {
    if (error instanceof NotInitialised) return 'missing'
    throw error
  }
}

async function disableLazyFetch(root: string) {
  // All catalog objects used by readPlan were materialised during the explicit refresh. Leaving this repository as
  // a promisor would let a later read contact the remote implicitly, which would turn viewing into a refresh.
  await git(root, ['config', 'remote.origin.promisor', 'false'])
  await git(root, ['config', '--unset-all', 'remote.origin.partialclonefilter']).catch(() => '')
  await git(root, ['config', '--unset-all', 'extensions.partialClone']).catch(() => '')
}

async function requireTreelessFetch(root: string, commit: string) {
  const promisor = await git(root, ['config', '--bool', 'remote.origin.promisor']).catch(() => '')
  const filter = await git(root, ['config', 'remote.origin.partialclonefilter']).catch(() => '')
  const extension = await git(root, ['config', 'extensions.partialClone']).catch(() => '')
  if (promisor !== 'true' || filter !== 'tree:0') throw new InvalidInput('Remote did not accept a treeless Git fetch')
  // With the promisor disabled, cat-file cannot lazily repair a server that ignored the filter. A tree already in
  // the object database proves the fetch was not treeless, so reject the refresh before catalog reads fetch any.
  await git(root, ['config', 'remote.origin.promisor', 'false'])
  await git(root, ['config', '--unset-all', 'remote.origin.partialclonefilter']).catch(() => '')
  await git(root, ['config', '--unset-all', 'extensions.partialClone']).catch(() => '')
  const treePresent = await git(root, ['cat-file', '-e', `${commit}^{tree}`]).then(() => true, () => false)
  if (extension) await git(root, ['config', 'extensions.partialClone', extension])
  await git(root, ['config', 'remote.origin.partialclonefilter', filter])
  await git(root, ['config', 'remote.origin.promisor', 'true'])
  if (treePresent) throw new InvalidInput('Remote ignored the treeless Git filter; refusing to cache source objects')
}

async function readCurrent(bucket: string, expectedRepository: string): Promise<CatalogCacheEntry | null> {
  const raw = await readFile(await safePath(bucket, 'current.json'), 'utf8').catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  })
  if (raw === null) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch (error) { throw new InvalidInput('Invalid Hub catalog cache metadata', { cause: error }) }
  const parsed = cacheStatusSchema.safeParse(value)
  if (!parsed.success || parsed.data.repository !== expectedRepository) throw new InvalidInput('Invalid Hub catalog cache metadata')
  const status = parsed.data
  const root = await safePath(bucket, `entries/${status.generation}/repository`)
  const info = await lstat(root).catch(() => null)
  if (!info?.isDirectory()) throw new InvalidInput('Hub catalog cache entry is missing')
  await validateNoCheckout(root)
  if (status.status === 'ready' && await validateCatalog(root, status.defaultCommit) !== 'ready') {
    throw new InvalidInput('Hub catalog cache no longer contains a valid catalog')
  }
  const { generation: _generation, defaultCommit: ref, ...rest } = status
  return { ...rest, root, ref }
}

/** Read and revalidate an existing cache entry. This never contacts the remote or changes the cached revision. */
export async function readCatalogCache(repository: string, options: CatalogCacheOptions = {}): Promise<CatalogCacheEntry | null> {
  const identity = repositoryIdentity(repository)
  const base = path.resolve(options.cacheRoot ?? catalogCacheRoot())
  const info = await lstat(base).catch(() => null)
  if (!info) return null
  if (!info.isDirectory() || info.isSymbolicLink()) throw new InvalidInput('Invalid Hub catalog cache directory')
  const bucket = path.join(await realpath(base), digest(identity))
  const bucketInfo = await lstat(bucket).catch(() => null)
  if (!bucketInfo) return null
  if (!bucketInfo.isDirectory() || bucketInfo.isSymbolicLink()) throw new InvalidInput('Invalid Hub catalog cache entry')
  return withLock(bucket, () => readCurrent(bucket, identity), 'refresh.lock')
}

/**
 * Explicitly fetch the default branch and commit graph into a new treeless Git repository. No checkout is created.
 * The previous entry remains current until the fetched `.groundwork/` data has passed the ordinary plan reader.
 */
export async function refreshCatalogCache(request: CatalogCacheRequest, options: CatalogCacheOptions = {}): Promise<CatalogCacheEntry> {
  const { repository, recordedCommits } = normaliseRequest(request)
  const remote = await safeRemote(request.remote)
  await verifyRemoteIdentity(repository, remote, options.allowUnverifiedLocalRemote === true)
  const base = await ensureOwnedDirectory(path.resolve(options.cacheRoot ?? catalogCacheRoot()))
  const bucket = await ensureOwnedDirectory(path.join(base, digest(repository)))
  const entries = await ensureOwnedDirectory(path.join(bucket, 'entries'))
  return withLock(bucket, async () => {
    const id = randomUUID()
    const directory = path.join(entries, id)
    const root = path.join(directory, 'repository')
    await mkdir(root, { recursive: true, mode: 0o700 })
    try {
      await run('git', ['init', '--quiet', '--initial-branch=main', '--', root])
      await git(root, ['remote', 'add', 'origin', remote.url])
      const advertised = parseDefaultHead(await git(root, ['ls-remote', '--symref', 'origin', 'HEAD']))
      await git(root, ['fetch', '--filter=tree:0', '--no-tags', '--quiet', 'origin',
        `+refs/heads/${advertised.branch}:refs/remotes/origin/${advertised.branch}`])
      await git(root, ['update-ref', `refs/heads/${advertised.branch}`, `refs/remotes/origin/${advertised.branch}`])
      await git(root, ['symbolic-ref', 'HEAD', `refs/heads/${advertised.branch}`])
      const defaultCommit = objectId.parse(await git(root, ['rev-parse', '--verify', 'HEAD^{commit}']))
      if (defaultCommit !== advertised.commit.toLowerCase()) throw new InvalidInput('Default branch changed while the Hub cache was fetched; refresh again')
      await requireTreelessFetch(root, defaultCommit)
      const recorded = [] as CatalogCacheStatus['recordedCommits']
      for (const revision of recordedCommits) {
        let available = await git(root, ['cat-file', '-e', `${revision}^{commit}`]).then(() => true, () => false)
        if (!available) {
          available = await git(root, ['fetch', '--filter=tree:0', '--no-tags', '--quiet', '--end-of-options', 'origin', revision])
            .then(() => true, () => false)
        }
        if (available) await git(root, ['update-ref', `refs/groundwork/recorded/${revision}`, revision])
        recorded.push({ revision, available })
      }
      const status = await validateCatalog(root, defaultCommit)
      await validateNoCheckout(root)
      await disableLazyFetch(root)
      // Re-read after disabling the promisor. Success proves ordinary consumers have every object they need and will
      // not trigger an implicit network request later.
      if (status === 'ready' && await validateCatalog(root, defaultCommit) !== 'ready') {
        throw new InvalidInput('Fetched Hub catalog is incomplete')
      }
      const fetchedAt = (options.now ?? (() => new Date()))().toISOString()
      const metadata = cacheStatusSchema.parse({
        version: 1, generation: id, repository, status, defaultBranch: advertised.branch, defaultCommit,
        fetchedAt, source: 'hub-cache', sourceLabel: `Hub cache · ${advertised.branch}@${defaultCommit.slice(0, 12)} · fetched ${fetchedAt}`,
        trust: 'untrusted', recordedCommits: recorded,
      })
      await readonlyTree(root)
      await atomicFile(bucket, 'current.json', JSON.stringify(metadata, null, 2) + '\n', 0o600)
      for (const entry of await readdir(entries)) if (entry !== id && generation.safeParse(entry).success) {
        await removeTree(path.join(entries, entry)).catch(() => undefined)
      }
      return (await readCurrent(bucket, repository))!
    } catch (error) {
      await removeTree(directory).catch(() => undefined)
      throw error
    }
  }, 'refresh.lock')
}
