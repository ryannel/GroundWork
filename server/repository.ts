import { link, lstat, mkdir, open, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { decodeStorage, encodeStorage, physicalDocumentPattern } from './catalog-storage.ts'
import { Conflict, InvalidInput } from './errors.ts'
import { assetPattern, documentPattern, parsePlan, type Files, type Plan } from './format.ts'
import { context, digest, git, gitRaw, resolveRef } from './git.ts'
import {
  GROUNDWORK_DIR, JOURNAL_FILE, LOCK_FILE, MAX_DOCUMENT_BYTES, MEMBERS_DIR, CATALOG_DIR, LOCAL_CATALOGS_DIR, PLANS_DIR, PRODUCTS_DIR,
  STORAGE_ROOTS, TEMP_FILE_PATTERN,
} from './paths.ts'
import { validateTransition, type Changes } from './transitions.ts'

export { Conflict }

type Context = Awaited<ReturnType<typeof context>>
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/** Maps ENOENT to `value` and rethrows anything else. */
function absent<T>(error: NodeJS.ErrnoException, value: T): T {
  if (error.code === 'ENOENT') return value
  throw error
}

export async function safePath(root: string, relative: string) {
  const parts = relative ? relative.split(/[\\/]/) : []
  if (!parts.length || path.isAbsolute(relative) || parts.some(part => !part || part === '.' || part === '..')) throw new InvalidInput('Invalid relative path')
  let current = await realpath(root)
  for (const part of parts) {
    current = path.join(current, part)
    const stat = await lstat(current).catch(error => absent(error, null))
    if (stat?.isSymbolicLink()) throw new InvalidInput(`Symbolic links are not allowed: ${relative}`)
  }
  return current
}

export async function readStorageFiles(root: string, ref?: string): Promise<Files> {
  const files: Files = {}
  const accept = (name: string) => {
    // Leftovers of an interrupted atomicFile; `recover` removes them.
    if (TEMP_FILE_PATTERN.test(name)) return false
    if (name.startsWith(`${PLANS_DIR}/`) && assetPattern.test(name.slice(PLANS_DIR.length + 1))) return false
    if (!physicalDocumentPattern.test(name)) throw new InvalidInput(`Unsupported catalog/planning file: ${name}`)
    return true
  }
  if (ref) {
    const sha = await resolveRef(root, ref)
    const entries = (await git(root, ['ls-tree', '-r', '-z', sha, '--', ...STORAGE_ROOTS])).split('\0').filter(Boolean)
    for (const entry of entries) {
      const [meta, name] = entry.split('\t')
      if (!meta.startsWith('100644 ') && !meta.startsWith('100755 ')) throw new InvalidInput(`Unsupported Git file mode: ${name}`)
      if (accept(name)) files[name] = await gitRaw(root, ['show', `${sha}:${name}`])
    }
    return files
  }
  // safePath checks each top-level root once; below that every entry is lstat-ed exactly once while walking.
  async function visit(name: string, file: string) {
    const stat = await lstat(file).catch(error => absent(error, null))
    if (!stat) return
    if (stat.isSymbolicLink()) throw new InvalidInput(`Symbolic links are not allowed: ${name}`)
    if (stat.isDirectory()) {
      for (const child of await readdir(file)) await visit(`${name}/${child}`, path.join(file, child))
    } else if (stat.isFile() && accept(name)) {
      if (stat.size > MAX_DOCUMENT_BYTES) throw new InvalidInput(`${name}: document exceeds 2 MB`)
      files[name] = await readFile(file, 'utf8')
    }
  }
  for (const name of STORAGE_ROOTS) await visit(name, await safePath(root, name))
  return files
}
export async function readFiles(root: string, ref?: string): Promise<Files> {
  return decodeStorage(await readStorageFiles(root, ref)).files
}
export const revision = (files: Files) => digest(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))))

async function durable(file: string, data: string, mode: number | undefined) {
  const handle = await open(file, 'wx', mode ?? 0o666)
  try {
    // An explicit mode is applied exactly; otherwise the umask decides, as for any new file.
    if (mode !== undefined) await handle.chmod(mode)
    await handle.writeFile(data)
    await handle.sync()
  } finally { await handle.close() }
}
/** Makes a rename or unlink in `directory` durable. Some platforms cannot open directories; that is not an error. */
async function syncDirectory(directory: string) {
  const handle = await open(directory, 'r').catch(() => null)
  try { await handle?.sync() } catch { /* Directory fsync is unsupported here. */ } finally { await handle?.close() }
}
/**
 * Replaces `relative` with `data` (or deletes it for null) via a synced temp file and rename.
 * The file keeps its existing mode; new files get the default mode unless `mode` is given (0o600 for Groundwork-internal files).
 */
export async function atomicFile(root: string, relative: string, data: string | null, mode?: number) {
  const file = await safePath(root, relative)
  const directory = path.dirname(file)
  if (data === null) {
    await rm(file, { force: true })
    await syncDirectory(directory)
    return
  }
  await mkdir(directory, { recursive: true })
  const existing = mode === undefined ? await lstat(file).catch(error => absent(error, null)) : null
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await durable(temporary, data, mode ?? (existing ? existing.mode & 0o7777 : undefined))
    await rename(temporary, file)
  } finally { await rm(temporary, { force: true }) }
  await syncDirectory(directory)
}

interface LockOwner { pid: number; host?: string; nonce?: string; startedAt?: number }
const LOCK_ATTEMPTS = 50, LOCK_DELAY_MS = 50, STALE_BREAKER_MS = 10_000
async function readLockOwner(file: string): Promise<LockOwner | null> {
  const raw = await readFile(file, 'utf8').catch(error => absent(error, null))
  if (raw === null) return null
  let owner: LockOwner | null = null
  try { owner = JSON.parse(raw) } catch { /* Reported below. */ }
  if (!owner || !Number.isInteger(owner.pid) || owner.pid <= 0) {
    throw new Conflict(`Invalid lock file ${path.basename(file)}; inspect it and delete it if no Groundwork process is running`)
  }
  return owner
}
function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true // Alive, owned by another user.
    throw error
  }
}
/** Only locks written on this host can be judged: a PID from another machine or container means nothing here. */
const isStale = (owner: LockOwner) => (owner.host === undefined || owner.host === hostname()) && !isAlive(owner.pid)
const sameOwner = (a: LockOwner, b: LockOwner) => a.pid === b.pid && a.nonce === b.nonce
/**
 * Breakers take a short-lived mutex and re-read the lock under it, so a lock is only ever removed while it still
 * names the dead owner. Renaming the lock aside instead could briefly move a live lock that another waiter had just
 * taken, letting a third waiter in while the second was still inside.
 */
async function breakStaleLock(lock: string, stale: LockOwner) {
  const breaker = `${lock}.break`
  try { await writeFile(breaker, String(process.pid), { flag: 'wx', mode: 0o600 }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    // Held only for one read and one unlink; an old file means its breaker crashed mid-break.
    const held = await lstat(breaker).catch(() => null)
    if (held && Date.now() - held.mtimeMs > STALE_BREAKER_MS) await rm(breaker, { force: true })
    else await sleep(5)
    return
  }
  try {
    const current = await readLockOwner(lock).catch(() => null)
    if (current && sameOwner(current, stale)) await rm(lock, { force: true })
  } finally { await rm(breaker, { force: true }) }
}
async function acquireLock(lock: string): Promise<LockOwner> {
  const owner = { pid: process.pid, host: hostname(), nonce: randomUUID(), startedAt: Date.now() }
  // The lock is published complete by link(), so a contender never sees an empty or partial lock file.
  const staged = `${lock}.${owner.nonce}.tmp`
  await writeFile(staged, JSON.stringify(owner), { flag: 'wx', mode: 0o600 })
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await link(staged, lock)
        return owner
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
      const holder = await readLockOwner(lock)
      if (!holder) continue
      if (isStale(holder)) { await breakStaleLock(lock, holder); continue }
      if (attempt >= LOCK_ATTEMPTS) {
        const where = holder.host && holder.host !== hostname() ? ` on ${holder.host}` : ''
        throw new Conflict(`Another Groundwork process${where} is writing; retry shortly`)
      }
      await sleep(LOCK_DELAY_MS)
    }
  } finally { await rm(staged, { force: true }) }
}
async function releaseLock(lock: string, owner: LockOwner) {
  const holder = await readLockOwner(lock).catch(() => null)
  if (holder && sameOwner(holder, owner)) await rm(lock, { force: true })
}
export async function withLock<T>(root: string, fn: () => Promise<T>, name = LOCK_FILE): Promise<T> {
  const lock = await safePath(root, name)
  await mkdir(path.dirname(lock), { recursive: true })
  const owner = await acquireLock(lock)
  try { return await fn() } finally { await releaseLock(lock, owner) }
}

/** Version 3 keeps only the changed paths; version 2 kept whole catalogs; unversioned journals use logical plan names. */
interface Journal { version?: 2 | 3; before: Files; after: Files; paths: string[] }
const journalFile = (journal: Journal, name: string) => journal.version ? name : `${PLANS_DIR}/${name}`
async function readCurrent(root: string, relative: string) {
  return readFile(await safePath(root, relative), 'utf8').catch(error => absent(error, undefined))
}
/** Puts `names` back to their before-images and removes the journal; pauses, keeping the journal, if any was edited externally. */
async function restore(root: string, journal: Journal, names: string[]) {
  const written: string[] = []
  for (const name of names) {
    const current = await readCurrent(root, journalFile(journal, name))
    if (current === journal.before[name]) continue
    if (current !== journal.after[name]) {
      throw new Conflict(`Recovery paused: ${name} was edited externally. The journal preserves both versions in ${JOURNAL_FILE}.`)
    }
    written.push(name)
  }
  for (const name of written) await atomicFile(root, journalFile(journal, name), journal.before[name] ?? null)
  await rm(await safePath(root, JOURNAL_FILE), { force: true })
}
async function recoverUnlocked(root: string) {
  const raw = await readFile(await safePath(root, JOURNAL_FILE), 'utf8').catch(error => absent(error, null))
  if (raw === null) return
  let journal: Journal
  try { journal = JSON.parse(raw) } catch { throw new Conflict(`Invalid recovery journal ${JOURNAL_FILE}; inspect it before deleting it`) }
  const pattern = journal.version ? physicalDocumentPattern : documentPattern
  if (!Array.isArray(journal.paths) || !journal.before || !journal.after || journal.paths.some(name => !pattern.test(name))) {
    throw new Conflict('Invalid recovery journal')
  }
  await restore(root, journal, journal.paths)
}
/** Removes temp files an interrupted atomicFile left in catalog storage. Caller holds the write lock. */
async function removeOrphanedTemps(root: string) {
  async function sweep(directory: string, recursive: boolean) {
    const entries = await readdir(await safePath(root, directory), { withFileTypes: true }).catch(error => absent(error, []))
    for (const entry of entries) {
      const name = `${directory}/${entry.name}`
      if (entry.isDirectory() && recursive) await sweep(name, true)
      else if (entry.isFile() && TEMP_FILE_PATTERN.test(entry.name)) await rm(await safePath(root, name), { force: true })
    }
  }
  for (const directory of [PLANS_DIR, CATALOG_DIR, MEMBERS_DIR, PRODUCTS_DIR, LOCAL_CATALOGS_DIR]) await sweep(directory, true)
  // Top-level temps belong to project.json or the journal; staged lock files belong to live contenders and stay.
  const lockName = path.basename(LOCK_FILE)
  const entries = await readdir(await safePath(root, GROUNDWORK_DIR), { withFileTypes: true }).catch(error => absent(error, []))
  for (const entry of entries) {
    if (entry.isFile() && TEMP_FILE_PATTERN.test(entry.name) && !entry.name.startsWith(`${lockName}.`)) {
      await rm(await safePath(root, `${GROUNDWORK_DIR}/${entry.name}`), { force: true })
    }
  }
}
export async function recover(root: string) {
  return withLock(root, async () => {
    await recoverUnlocked(root)
    await removeOrphanedTemps(root)
  })
}

async function assetVersions(root: string, plan: Plan, ref?: string) {
  const assets: Record<string, string> = {}
  for (const feature of plan.snapshot.features) for (const mock of feature.spec?.design?.mockups ?? []) {
    if (!assetPattern.test(mock.ref) || mock.ref in assets) continue
    if (ref) {
      const record = await git(root, ['ls-tree', ref, '--', `${PLANS_DIR}/${mock.ref}`])
      if (!record.startsWith('100644 ') && !record.startsWith('100755 ')) throw new InvalidInput(`Missing or unsupported raster asset: ${mock.ref}`)
      assets[mock.ref] = record.split(/[ \t]/)[2]
    } else {
      const file = await safePath(root, `${PLANS_DIR}/${mock.ref}`)
      const stat = await lstat(file).catch(() => null)
      if (!stat?.isFile() || stat.size > 32 * 1024 * 1024) throw new InvalidInput(`Missing raster asset or larger than 32 MB: ${mock.ref}`)
      assets[mock.ref] = digest(`${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`)
    }
  }
  return assets
}
function planContext(ctx: Context, ref?: string, resolved?: string) {
  const token = ref ? digest(`${ctx.token}:${resolved}`) : ctx.token
  return { ...ctx, ref: ref ?? null, head: resolved ?? ctx.head, editable: !ref, token }
}
/** Reads without checking for a concurrent writer. Use `readPlan` unless this process holds the write lock. */
export async function readPlanUnlocked(root: string, ref?: string) {
  const ctx = await context(root)
  const resolved = ref ? await resolveRef(root, ref) : undefined
  const { files, layout } = decodeStorage(await readStorageFiles(root, resolved))
  const plan = parsePlan(files, { repository: ctx.repository, layout })
  const assets = await assetVersions(root, plan, resolved)
  if (!ref && (await context(root)).token !== ctx.token) throw new Conflict('The checkout changed while reading; retry')
  // The repository identity sits beside the manifest ID: one names the repository, the other the documents in it.
  return { ...plan, files, assets, layout, repository: ctx.repository, revision: revision(files), context: planContext(ctx, ref, resolved) }
}
const READ_ATTEMPTS = 10, READ_DELAY_MS = 20
const PENDING = 'A plan write or recovery is pending; retaining the previous snapshot. Run groundwork-v2 recover if a writer was interrupted.'
/** Whether a writer is active, and a stamp of the .groundwork directory, which changes whenever the lock or journal comes or goes. */
async function writeState(root: string) {
  const [directory, lock, journal] = await Promise.all([GROUNDWORK_DIR, LOCK_FILE, JOURNAL_FILE]
    .map(async name => lstat(await safePath(root, name)).catch(error => absent(error, null))))
  return { locked: !!lock, journal: !!journal, stamp: directory ? `${directory.mtimeMs}:${directory.ctimeMs}` : '' }
}
/**
 * Reads a consistent snapshot of the working tree, or of a committed `ref`. A read that overlaps a write is
 * retried briefly; an interrupted write (journal without a lock) fails at once because waiting cannot help.
 */
export async function readPlan(root: string, ref?: string) {
  if (ref) return readPlanUnlocked(root, ref)
  for (let attempt = 0; ; attempt++) {
    const start = await writeState(root)
    if (start.journal && !start.locked) throw new Conflict(PENDING)
    if (!start.locked) {
      let result: { plan: Awaited<ReturnType<typeof readPlanUnlocked>> } | { error: unknown }
      try { result = { plan: await readPlanUnlocked(root) } } catch (error) { result = { error } }
      const end = await writeState(root)
      if (!end.locked && !end.journal && end.stamp === start.stamp) {
        if ('error' in result) throw result.error
        return result.plan
      }
    }
    if (attempt >= READ_ATTEMPTS) throw new Conflict(PENDING)
    await sleep(READ_DELAY_MS * (attempt + 1))
  }
}

export interface WriteRequest { expectedRevision: string; expectedContext: string; changes: Changes }
export async function writePlan(root: string, request: WriteRequest) {
  const { expectedRevision, expectedContext, changes } = request
  if (!expectedRevision || !expectedContext || !changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new InvalidInput('Writes require expectedRevision, expectedContext and a changes object')
  }
  return withTransaction(root, async commit => {
    const ctx = await context(root)
    const storage = await readStorageFiles(root)
    const { layout, files: before } = decodeStorage(storage)
    if (ctx.token !== expectedContext || revision(before) !== expectedRevision) {
      throw new Conflict('Stale edit: re-read the selected checkout and reapply your changes')
    }
    const { after, plan } = validateTransition(before, changes, { repository: ctx.repository, layout })
    await assetVersions(root, plan)
    const next = encodeStorage(after, layout)
    // commit() re-checks the context and every changed path against `storage` before it writes anything.
    await commit(storage, next, ctx.token)
    return { revision: revision(decodeStorage(next).files), context: planContext(ctx) }
  })
}

/** Applies a validated physical storage change: `before` must be what is on disk now. */
export type Commit = (before: Files, after: Files, expectedContext?: string) => Promise<void>
/** Runs `fn` under the write lock, after recovering any interrupted write. `fn` writes storage only through `commit`. */
export async function withTransaction<T>(root: string, fn: (commit: Commit) => Promise<T>): Promise<T> {
  return withLock(root, async () => {
    await recoverUnlocked(root)
    return fn((before, after, expectedContext) => transactStorage(root, before, after, expectedContext))
  })
}
const pick = (files: Files, names: string[]) => Object.fromEntries(names.filter(name => Object.hasOwn(files, name)).map(name => [name, files[name]]))
async function transactStorage(root: string, before: Files, after: Files, expectedContext?: string) {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name])
  if (paths.some(name => !physicalDocumentPattern.test(name))) throw new Error('Invalid storage transaction path')
  // Everything that can be checked is checked before the journal exists, so a refusal leaves nothing to recover.
  if (expectedContext && (await context(root)).token !== expectedContext) throw new Conflict('Checkout changed before the write; re-read and retry')
  for (const name of paths) {
    if ((await readCurrent(root, name)) !== before[name]) throw new Conflict(`External edit detected: ${name}; re-read and retry`)
  }
  const journal: Journal = { version: 3, paths, before: pick(before, paths), after: pick(after, paths) }
  await atomicFile(root, JOURNAL_FILE, JSON.stringify(journal), 0o600)
  const attempted: string[] = []
  try {
    for (const name of paths) {
      attempted.push(name)
      await atomicFile(root, name, after[name] ?? null)
    }
    if (expectedContext && (await context(root)).token !== expectedContext) throw new Conflict('Checkout changed during the write')
    if (revision(await readStorageFiles(root)) !== revision(after)) throw new Conflict('Storage changed during the write')
    await rm(await safePath(root, JOURNAL_FILE))
  } catch (error) {
    // Roll back only what this write touched; a path someone else changed meanwhile pauses recovery instead.
    try { await restore(root, journal, attempted) } catch (failure) {
      throw new Conflict(`${(failure as Error).message} The write itself failed with: ${(error as Error).message}`, { cause: error })
    }
    throw error
  }
}
