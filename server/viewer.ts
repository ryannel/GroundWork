import { realpath } from 'node:fs/promises'
import { Conflict } from './errors.ts'
import { serve } from './http.ts'
import { inventory, register } from './registry.ts'
import { viewerIdentity } from './viewer-identity.ts'
import { readPlan } from './repository.ts'
import { NotInitialised } from './format.ts'

type InventoryEntry = Awaited<ReturnType<typeof inventory>>[number]
/** A source checkout opens the owning home; the route's checkout ID must be able to read that home's plan. */
export function viewerProjectRoute(entry: InventoryEntry, entries: InventoryEntry[], sourceOnly: boolean) {
  if (entry.productPath && entry.homeRepositoryId && entry.homeRepositoryId !== entry.repositoryId) {
    const owner = entries.find(candidate => candidate.repositoryId === entry.homeRepositoryId && candidate.authoritativeHome && !candidate.error)
    if (!owner) throw new Error('The owning product home is not available in the Hub')
    return `/p/${owner.checkoutId}${entry.productPath}`
  }
  return sourceOnly ? '' : `/p/${entry.checkoutId}${entry.productPath ?? '/'}`
}

/**
 * A fixed local port is the rendezvous point; never allocate another server silently.
 * `viewerDirectory` overrides the built viewer in `dist/` (tests serve a stub page so they do not need a build).
 */
export async function startViewer(options: { root?: string; port?: number; viewerDirectory?: string } = {}) {
  const root = options.root ? await realpath(options.root) : undefined
  let sourceOnly = false
  if (root) await readPlan(root).catch(error => {
    if (error instanceof NotInitialised) { sourceOnly = true;
      return }
    throw error
  })
  const port = options.port ?? 4318
  const expected = await viewerIdentity()
  const base = `http://127.0.0.1:${port}`
  const probe = async () => {
    let response: Response
    try { response = await fetch(`${base}/api/viewer`, { signal: AbortSignal.timeout(1500), redirect: 'error' }) }
    catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') return false
      throw new Error(`Cannot identify the viewer on port ${port}. Check that service or choose --port explicitly.`, { cause: error })
    }
    const found = await response.json().catch(() => null)
    if (!response.ok || !found || Object.entries(expected).some(([key, value]) => found[key] !== value)) {
      throw new Conflict(`Port ${port} belongs to another service, project, or older Groundwork viewer. Stop it or choose --port explicitly.`)
    }
    return true
  }
  let app: Awaited<ReturnType<typeof serve>> | undefined
  if (!port || !await probe()) {
    try { app = await serve({ port, viewerDirectory: options.viewerDirectory }) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || !await probe()) throw error
    }
  }
  try {
    let url = app?.url ?? base
    if (root) {
      let entries = await inventory()
      let entry = entries.find(p => p.root === root && (!p.error || p.productPath))
      if (!entry) { await register(root);
        entries = await inventory();
        entry = entries.find(p => p.root === root && (!p.error || p.productPath)) }
      if (!entry) throw new Error('Could not register the project workspace')
      url += viewerProjectRoute(entry, entries, sourceOnly)
    }
    return { url, app, reused: !app, mode: expected.mode }
  } catch (error) { await app?.close();
    throw error }
}
