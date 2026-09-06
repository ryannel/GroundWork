import { mkdir, readdir, readFile, rename, rm, lstat, realpath, open } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { PLAN_DIRECTORY, documentPattern, assetPattern, parsePlan, type Files } from './format.ts'
import { context, digest, git, gitRaw, resolveRef } from './git.ts'

export class Conflict extends Error {}
export async function safePath(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error('Invalid relative path')
  root = await realpath(root)
  let current = root
  for (const part of relative.split('/')) {
    current = path.join(current, part)
    const stat = await lstat(current).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
    if (stat?.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${relative}`)
  }
  return current
}
export async function readFiles(root: string, ref?: string): Promise<Files> {
  const files: Files = {}
  if (ref) {
    const sha = await resolveRef(root, ref)
    const entries = (await git(root, ['ls-tree', '-r', '-z', sha, '--', PLAN_DIRECTORY])).split('\0').filter(Boolean)
    for (const entry of entries) {
      const [meta, full] = entry.split('\t')
      const name = full.slice(PLAN_DIRECTORY.length + 1)
      if (!meta.startsWith('100644 ') && !meta.startsWith('100755 ')) throw new Error(`Unsupported Git file mode: ${full}`)
      if (assetPattern.test(name)) continue
      if (!documentPattern.test(name)) throw new Error(`Unsupported planning file: ${name}`)
      files[name] = await gitRaw(root, ['show', `${sha}:${full}`])
    }
  } else {
    const base = await safePath(root, PLAN_DIRECTORY)
    async function visit(directory: string, prefix = '') {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const name = prefix + entry.name
        if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${name}`)
        if (entry.isDirectory()) await visit(path.join(directory, entry.name), name + '/')
        else if (entry.isFile()) {
          if (assetPattern.test(name)) continue
          if (!documentPattern.test(name)) throw new Error(`Unsupported planning file: ${name}`)
          const stat = await lstat(path.join(directory, entry.name))
          if (stat.size > 2 * 1024 * 1024) throw new Error(`${name}: document exceeds 2 MB`)
          files[name] = await readFile(path.join(directory, entry.name), 'utf8')
        }
      }
    }
    await visit(base)
  }
  return files
}
export const revision = (files: Files) => digest(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))))
async function durable(file: string, data: string) {
  const handle = await open(file, 'w', 0o600)
  try { await handle.writeFile(data); await handle.sync() } finally { await handle.close() }
}
export async function atomicFile(root: string, relative: string, data: string | null) {
  const file = await safePath(root, relative)
  if (data === null) { await rm(file, { force: true }); return }
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try { await durable(temporary, data); await rename(temporary, file) }
  finally { await rm(temporary, { force: true }) }
}
export async function withLock<T>(root: string, fn: () => Promise<T>, name = '.groundwork/write.lock'): Promise<T> {
  const lock = await safePath(root, name)
  await mkdir(path.dirname(lock), { recursive: true })
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await open(lock, 'wx', 0o600)
      await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close(); break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      let dead = false
      try {
        const { pid } = JSON.parse(await readFile(lock, 'utf8'))
        if (!Number.isInteger(pid) || pid <= 0) throw new Conflict('Invalid lock file; inspect it before recovery')
        try { process.kill(pid, 0) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') dead = true; else throw error }
      } catch (error) { if (error instanceof Conflict) throw error }
      if (dead) { await rm(lock, { force: true }); continue }
      if (attempt >= 50) throw new Conflict('Another Groundwork process is writing; retry shortly')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  try { return await fn() } finally { await rm(lock, { force: true }) }
}
interface Journal { before: Files; after: Files; paths: string[] }
async function recoverUnlocked(root: string) {
  const file = await safePath(root, '.groundwork/transaction.json')
  const raw = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (!raw) return
  const journal = JSON.parse(raw) as Journal
  for (const name of journal.paths) {
    if (!documentPattern.test(name)) throw new Conflict('Invalid recovery journal')
    const current = await readFile(await safePath(root, `${PLAN_DIRECTORY}/${name}`), 'utf8').catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
    if (current !== journal.before[name] && current !== journal.after[name]) throw new Conflict(`Recovery paused: ${name} was edited externally. The journal preserves both versions in .groundwork/transaction.json.`)
  }
  for (const name of journal.paths) await atomicFile(root, `${PLAN_DIRECTORY}/${name}`, journal.before[name] ?? null)
  await rm(file)
}
export async function recover(root: string) { return withLock(root, () => recoverUnlocked(root)) }
async function assetVersions(root: string, plan: ReturnType<typeof parsePlan>, ref?: string) {
  const assets: Record<string, string> = {}
  for (const feature of plan.snapshot.features) for (const mock of feature.spec?.design?.mockups ?? []) {
    if (!assetPattern.test(mock.ref) || mock.ref in assets) continue
    if (ref) {
      const record = await git(root, ['ls-tree', ref, '--', `${PLAN_DIRECTORY}/${mock.ref}`])
      if (!record.startsWith('100644 ') && !record.startsWith('100755 ')) throw new Error(`Missing or unsupported raster asset: ${mock.ref}`)
      assets[mock.ref] = record.split(/[ \t]/)[2]
    } else {
      const file = await safePath(root, `${PLAN_DIRECTORY}/${mock.ref}`)
      const stat = await lstat(file).catch(() => null)
      if (!stat?.isFile() || stat.size > 32 * 1024 * 1024) throw new Error(`Missing raster asset or larger than 32 MB: ${mock.ref}`)
      assets[mock.ref] = digest(`${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`)
    }
  }
  return assets
}
export async function readPlan(root: string, ref?: string) {
  const ctx = await context(root)
  if (!ref) {
    for (const name of ['write.lock', 'transaction.json']) if (await lstat(await safePath(root, `.groundwork/${name}`)).catch(() => null)) throw new Conflict('A plan write or recovery is pending; retaining the previous snapshot. Run groundwork-v2 recover if a writer was interrupted.')
  }
  const resolved = ref ? await resolveRef(root, ref) : undefined
  const files = await readFiles(root, resolved)
  const plan = parsePlan(files)
  const assets = await assetVersions(root, plan, resolved)
  if (!ref && (await context(root)).token !== ctx.token) throw new Conflict('The checkout changed while reading; retry')
  return { ...plan, files, assets, revision: revision(files), context: { ...ctx, ref: ref ?? null, head: resolved ?? ctx.head, editable: !ref, token: ref ? digest(`${ctx.token}:${resolved}`) : ctx.token } }
}
export interface WriteRequest { expectedRevision: string; expectedContext: string; changes: Record<string, string | null> }
export async function writePlan(root: string, request: WriteRequest) {
  if (!request.expectedRevision || !request.expectedContext || !request.changes || typeof request.changes !== 'object' || Array.isArray(request.changes)) throw new Conflict('Writes require expectedRevision, expectedContext and a changes object')
  return withLock(root, async () => {
    await recoverUnlocked(root)
    const ctx = await context(root)
    const before = await readFiles(root)
    if (ctx.token !== request.expectedContext || revision(before) !== request.expectedRevision) throw new Conflict('Stale edit: re-read the selected checkout and reapply your changes')
    const after = { ...before }
    const paths = Object.keys(request.changes)
    if (!paths.length) throw new Error('No changes supplied')
    for (const [name, value] of Object.entries(request.changes)) {
      if (!documentPattern.test(name) || (value !== null && typeof value !== 'string')) throw new Error(`Invalid document change: ${name}`)
      if (value !== null && Buffer.byteLength(value) > 2 * 1024 * 1024) throw new Error(`${name}: document exceeds 2 MB`)
      if (value === null) delete after[name]; else after[name] = value
    }
    const candidate = parsePlan(after)
    await assetVersions(root, candidate)
    if (candidate.manifest.id !== parsePlan(before).manifest.id) throw new Conflict('A project ID is immutable after initialisation')
    if ((await context(root)).token !== ctx.token || revision(await readFiles(root)) !== revision(before)) throw new Conflict('Checkout changed during validation')
    await atomicFile(root, '.groundwork/transaction.json', JSON.stringify({ before, after, paths }))
    try {
      for (const name of paths) {
        const existing = await readFile(await safePath(root, `${PLAN_DIRECTORY}/${name}`), 'utf8').catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
        if (existing !== before[name]) throw new Conflict(`External edit detected: ${name}`)
        await atomicFile(root, `${PLAN_DIRECTORY}/${name}`, after[name] ?? null)
      }
      if ((await context(root)).token !== ctx.token || revision(await readFiles(root)) !== revision(after)) throw new Conflict('Checkout changed during the write')
      await rm(await safePath(root, '.groundwork/transaction.json'))
    } catch (error) {
      await recoverUnlocked(root) // Refuses to overwrite conflicting external changes.
      throw error
    }
    return { revision: revision(after), context: ctx }
  })
}
