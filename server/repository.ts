import { decodeStorage, encodeStorage, physicalDocumentPattern } from './catalog-storage.ts'
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
export async function readStorageFiles(root: string, ref?: string): Promise<Files> {
  const files: Files = {}
  const roots = ['.groundwork/plans', '.groundwork/catalog', '.groundwork/members', '.groundwork/project.json']
  const accept = (name: string) => {
    if (name.startsWith('.groundwork/plans/') && assetPattern.test(name.slice('.groundwork/plans/'.length))) return false
    if (!physicalDocumentPattern.test(name)) throw new Error(`Unsupported catalog/planning file: ${name}`)
    return true
  }
  if (ref) {
    const sha = await resolveRef(root, ref)
    const entries = (await git(root, ['ls-tree', '-r', '-z', sha, '--', ...roots])).split('\0').filter(Boolean)
    for (const entry of entries) {
      const [meta, name] = entry.split('\t')
      if (!meta.startsWith('100644 ') && !meta.startsWith('100755 ')) throw new Error(`Unsupported Git file mode: ${name}`)
      if (accept(name)) files[name] = await gitRaw(root, ['show', `${sha}:${name}`])
    }
  } else {
    async function visit(name: string) {
      const file = await safePath(root, name)
      const stat = await lstat(file).catch(error => { if (error.code === 'ENOENT') return null; throw error })
      if (!stat) return
      if (stat.isDirectory()) for (const child of await readdir(file)) await visit(`${name}/${child}`)
      else if (stat.isFile() && accept(name)) {
        if (stat.size > 2 * 1024 * 1024) throw new Error(`${name}: document exceeds 2 MB`)
        files[name] = await readFile(file, 'utf8')
      }
    }
    for (const name of roots) await visit(name)
  }
  return files
}
export async function readFiles(root: string, ref?: string): Promise<Files> {
  return decodeStorage(await readStorageFiles(root, ref)).files
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
      } catch (error) {
        if (error instanceof Conflict) throw error
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        if (error instanceof SyntaxError) throw new Conflict('Invalid lock file; inspect it before recovery')
        throw error
      }
      if (dead) { await rm(lock, { force: true }); continue }
      if (attempt >= 50) throw new Conflict('Another Groundwork process is writing; retry shortly')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  try { return await fn() } finally { await rm(lock, { force: true }) }
}
interface Journal { version?: 2; before: Files; after: Files; paths: string[] }
async function recoverUnlocked(root: string) {
  const file = await safePath(root, '.groundwork/transaction.json')
  const raw = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (!raw) return
  const journal = JSON.parse(raw) as Journal
  for (const name of journal.paths) {
    if (!(journal.version === 2 ? physicalDocumentPattern : documentPattern).test(name)) throw new Conflict('Invalid recovery journal')
    const current = await readFile(await safePath(root, journal.version === 2 ? name : `${PLAN_DIRECTORY}/${name}`), 'utf8').catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
    if (current !== journal.before[name] && current !== journal.after[name]) throw new Conflict(`Recovery paused: ${name} was edited externally. The journal preserves both versions in .groundwork/transaction.json.`)
  }
  for (const name of journal.paths) await atomicFile(root, journal.version === 2 ? name : `${PLAN_DIRECTORY}/${name}`, journal.before[name] ?? null)
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
  const { files, layout } = decodeStorage(await readStorageFiles(root, resolved))
  const plan = parsePlan(files)
  const assets = await assetVersions(root, plan, resolved)
  if (!ref && (await context(root)).token !== ctx.token) throw new Conflict('The checkout changed while reading; retry')
  return { ...plan, files, assets, layout, revision: revision(files), context: { ...ctx, ref: ref ?? null, head: resolved ?? ctx.head, editable: !ref, token: ref ? digest(`${ctx.token}:${resolved}`) : ctx.token } }
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
      if ((name.includes('/assessments/') || name.includes('/baselines/') || name.startsWith('scan-manifests/')) && before[name] && before[name] !== value) throw new Conflict('Retained discovery baselines and scan manifests are immutable; capture a new packet instead')
      if (value === null) delete after[name]; else after[name] = value
    }
    const candidate = parsePlan(after)
    for (const previous of parsePlan(before).snapshot.components) {
      const next = candidate.snapshot.components.find(component => component.id === previous.id)
      for (const field of ['retiredObservations', 'catalogChanges'] as const) {
        const retained = previous[field] ?? []
        if (retained.length && JSON.stringify(next?.[field]?.slice(0, retained.length)) !== JSON.stringify(retained)) throw new Conflict('Retired observations and catalog rename history are append-only')
      }
    }
    await assetVersions(root, candidate)
    if (candidate.manifest.id !== parsePlan(before).manifest.id) throw new Conflict('A project ID is immutable after initialisation')
    if ((await context(root)).token !== ctx.token || revision(await readFiles(root)) !== revision(before)) throw new Conflict('Checkout changed during validation')
    const storage = await readStorageFiles(root)
    const { layout, files: latest } = decodeStorage(storage)
    if (revision(latest) !== revision(before)) throw new Conflict('Catalog changed before storage write')
    const nextStorage = encodeStorage(after, layout)
    const canonical = decodeStorage(nextStorage).files
    await transactStorage(root, storage, nextStorage, ctx.token)
    return { revision: revision(canonical), context: ctx }

  })
}

/** Caller holds the workspace lock and has validated the full candidate. */
export async function transactStorage(root: string, before: Files, after: Files, expectedContext?: string) {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name])
  if (paths.some(name => !physicalDocumentPattern.test(name))) throw new Error('Invalid storage transaction path')
  await atomicFile(root, '.groundwork/transaction.json', JSON.stringify({ version: 2, before, after, paths }))
  try {
    for (const name of paths) {
      const current = await readFile(await safePath(root, name), 'utf8').catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
      if (current !== before[name]) throw new Conflict(`External edit detected: ${name}`)
      await atomicFile(root, name, after[name] ?? null)
    }
    if (expectedContext && (await context(root)).token !== expectedContext) throw new Conflict('Checkout changed during the write')
    if (revision(await readStorageFiles(root)) !== revision(after)) throw new Conflict('Storage changed during the write')
    await rm(await safePath(root, '.groundwork/transaction.json'))
  } catch (error) { await recoverUnlocked(root); throw error }
}
