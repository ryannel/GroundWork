import { realpath } from 'node:fs/promises'
import { Conflict, InvalidInput } from './errors.ts'
import { serve } from './http.ts'
import { inventory, register } from './registry.ts'
import { viewerIdentity } from './viewer-identity.ts'
import { readPlan } from './repository.ts'

/**
 * A fixed local port is the rendezvous point; never allocate another server silently.
 * `viewerDirectory` overrides the built viewer in `dist/` (tests serve a stub page so they do not need a build).
 */
export async function startViewer(options: { root?: string; standalone?: boolean; port?: number; viewerDirectory?: string } = {}) {
  const root = options.root ? await realpath(options.root) : undefined
  if (root) await readPlan(root)
  if (options.standalone && !root) throw new InvalidInput('Standalone mode requires a project directory')
  const port = options.port ?? (options.standalone ? 4317 : 4318)
  const expected = await viewerIdentity(options.standalone ? root : undefined)
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
    try { app = await serve({ root: options.standalone ? root : undefined, port, viewerDirectory: options.viewerDirectory }) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || !await probe()) throw error
    }
  }
  try {
    let url = app?.url ?? base
    if (root && !options.standalone) {
      let entry = (await inventory()).find(p => p.root === root && !p.error)
      if (!entry) { await register(root); entry = (await inventory()).find(p => p.root === root && !p.error) }
      if (!entry) throw new Error('Could not register the project workspace')
      url += `/p/${entry.checkoutId}/`
    }
    return { url, app, reused: !app, mode: expected.mode }
  } catch (error) { await app?.close(); throw error }
}
