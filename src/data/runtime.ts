import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import type { CatalogIdentity } from './catalog-index.ts'
import type { ContentSnapshot } from './content.ts'
import type { Delivery } from './delivery.ts'
export interface Checkout {
  checkoutId: string
  registryVersion: 2 | 3
  /** The repository checked out here; a source checkout can point to a product in another home. */
  repositoryId: string
  homeRepositoryId: string | null
  productId: string | null
  productRefs: { repository: string; product: string; slug: string; name: string; path: string; workspaceNames: string[];
    componentIds: string[]; componentKeys: string[]; declaredRepositories: string[];
    features: { id: string; title: string; stage: string }[] }[]
  workspaceNames: string[]
  preferred: boolean
  authoritativeHome: boolean
  cloneDisagreement?: { status: 'different' | 'diverged' | 'unknown'; heads: { root: string; head: string | null }[] } | null
  root: string
  repositoryRoot: string
  repositories: string[]
  components: { id: string; name: string; repository: string | null; sourcePath: string }[]
  productPath: string | null
  projectId: string | null
  name: string
  planName: string | null
  workspace: string
  product: string
  branch: string | null
  head: string | null
  isGit?: boolean
  features: { id: string; title: string; stage: string }[]
  error: string | null
}
export interface RuntimePlan {
  manifest: { id: string; name: string; domain?: string }
  /** Which IDs this catalog answers to, so the viewer resolves an entry exactly as the service does. */
  identity: CatalogIdentity
  snapshot: ContentSnapshot
  revision: string
  context: {
    checkoutId: string; root: string; branch: string | null; head: string | null; ref: string | null; editable: boolean; token: string; isGit: boolean
  }
  files: Record<string, string>
  delivery: Record<string, Delivery>
  decisions: Record<string, string>
  activity: { branches: string[]; changes: string[]; commits: string[] }
}
export interface RuntimeState {
  loading: boolean; mode: 'standalone' | 'central'; connected: boolean; plan: RuntimePlan | null; error: string | null; projects: Checkout[]
}

/*
 * Wire protocol. The same-origin service already validated the plan with loadContent, so these schemas only
 * check the envelope the viewer relies on and pass everything else through unchanged.
 */
const sessionSchema = z.looseObject({ mode: z.enum(['central', 'standalone']) })
const checkoutSchema = z.looseObject({ checkoutId: z.string() })
const planSchema = z.looseObject({
  manifest: z.looseObject({ name: z.string() }),
  identity: z.looseObject({ manifest: z.looseObject({ id: z.string() }) }),
  snapshot: z.looseObject({
    workspaces: z.array(z.unknown()), products: z.array(z.unknown()), components: z.array(z.unknown()), features: z.array(z.unknown()),
  }),
  revision: z.string(),
  context: z.looseObject({ token: z.string() }),
})
const eventSchema = z.object({ plan: planSchema.nullable(), error: z.string().nullable() })
const parse = <T>(schema: z.ZodType<T>, value: unknown, error: string) => {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(error)
  return result.data
}

const POLL_MS = 3000
const EVENT_SOURCE_CLOSED = 2 // EventSource.CLOSED: the browser will not reconnect on its own.
const connectionLost = 'Connection lost. Showing the last received plan; reconnecting…'
const connectionClosed = 'Connection closed by the Groundwork service. Reload the page to reconnect.'
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const decode = (value: string | undefined) => { try { return value === undefined ? undefined : decodeURIComponent(value) } catch { return undefined } }

type Timers = { set: (callback: () => void, ms: number) => unknown; clear: (handle: unknown) => void }
const defaultTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/** One viewer runtime per page location. Tests build fresh instances; the app uses the default one below. */
export function createRuntime(pathname: string, timers: Timers = defaultTimers) {
  let state: RuntimeState = { loading: true, mode: 'standalone', connected: false, plan: null, error: null, projects: [] }
  const listeners = new Set<() => void>()
  let generation = 0
  let events: EventSource | undefined
  let projectPoll: unknown
  let projectRequest: { generation: number; controller: AbortController; promise: Promise<void> } | undefined
  const route = /^\/p\/([^/]+)(?:\/ref\/([^/]+))?/.exec(pathname)
  const checkoutId = route?.[1]
  const selectedRef = decode(route?.[2])
  const query = new URLSearchParams({ ...(checkoutId ? { checkoutId } : {}), ...(selectedRef ? { ref: selectedRef } : {}) }).toString()
  const publish = (patch: Partial<RuntimeState>) => { state = { ...state, ...patch }; for (const listener of listeners) listener() }

  const subscribe = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback) } }
  const getRuntime = () => state

  /** At most one project request is in flight; a restart aborts it rather than letting it publish late. */
  function refreshProjects(): Promise<void> {
    const current = generation
    if (projectRequest?.generation === current) return projectRequest.promise
    projectRequest?.controller.abort()
    const controller = new AbortController()
    const promise = (async () => {
      try {
        const response = await fetch('/api/projects', { signal: controller.signal })
        if (!response.ok) throw new Error('Could not load registered projects')
        const projects = parse(z.array(checkoutSchema), await response.json(), 'Invalid registered projects response')
        // Only the envelope is checked; see the wire-protocol note above.
        if (current === generation) publish({ projects: projects as unknown as Checkout[], ...(!checkoutId ? { error: null } : {}) })
      } catch (error) {
        if (current === generation && !controller.signal.aborted) throw error
      } finally {
        if (projectRequest?.controller === controller) projectRequest = undefined
      }
    })()
    projectRequest = { generation: current, controller, promise }
    return promise
  }

  /** Self-scheduling: the next poll starts only after the previous one settles. */
  async function pollProjects(current: number) {
    if (current !== generation) return
    try { await refreshProjects() }
    catch (error) { if (current === generation) publish({ error: message(error) }) }
    if (current === generation) projectPoll = timers.set(() => void pollProjects(current), POLL_MS)
  }

  async function startRuntime() {
    const current = ++generation
    events?.close()
    events = undefined
    if (projectPoll !== undefined) timers.clear(projectPoll)
    projectPoll = undefined
    projectRequest?.controller.abort()
    projectRequest = undefined
    publish({ loading: true })
    try {
      const response = await fetch('/api/session')
      if (current !== generation) return
      if (!response.ok) throw new Error('Groundwork service is unavailable')
      const session = parse(sessionSchema, await response.json(), 'Invalid Groundwork service response')
      if (current !== generation) return
      publish({ mode: session.mode, connected: true })
      if (session.mode === 'central' && !checkoutId) {
        await pollProjects(current)
        if (current === generation) publish({ loading: false })
        return
      }
      if (session.mode === 'central') {
        try { await refreshProjects() }
        catch (error) { if (current === generation) publish({ error: message(error) }) }
      }
      if (current !== generation) return
      const source = events = new EventSource(`/api/events?${query}`)
      source.onopen = () => {
        if (current !== generation) return
        publish({ connected: true, ...(state.error === connectionLost || state.error === connectionClosed ? { error: null } : {}) })
      }
      source.onmessage = event => {
        if (current !== generation) return
        try {
          const { plan, error } = parse(eventSchema, JSON.parse(event.data), 'Invalid Groundwork event response')
          // Only the envelope is checked; see the wire-protocol note above.
          const runtimePlan = plan as unknown as RuntimePlan | null
          publish({ plan: runtimePlan, error, loading: false, connected: true })
        } catch (error) {
          publish({ loading: false, error: message(error) })
        }
      }
      source.onerror = () => {
        if (current !== generation) return
        publish({ loading: false, connected: false, error: source.readyState === EVENT_SOURCE_CLOSED ? connectionClosed : connectionLost })
      }
    } catch (error) {
      if (current === generation) publish({ loading: false, connected: false, error: message(error) })
    }
  }

  return { runtimeBase: route?.[0] ?? '/', checkoutId, selectedRef, subscribe, getRuntime, refreshProjects, startRuntime }
}

const runtime = createRuntime(typeof window === 'undefined' ? '/' : window.location.pathname)
export const { runtimeBase, checkoutId, selectedRef, getRuntime, refreshProjects, startRuntime } = runtime
export const useRuntime = () => useSyncExternalStore(runtime.subscribe, runtime.getRuntime)
