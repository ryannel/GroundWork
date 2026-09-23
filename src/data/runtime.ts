import { useSyncExternalStore } from 'react'
import type { ContentSnapshot } from './content'
import type { Delivery } from './delivery'
export interface Checkout {
  checkoutId: string
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
  snapshot: ContentSnapshot
  revision: string
  context: { checkoutId: string; root: string; branch: string | null; head: string | null; ref: string | null; editable: boolean; token: string; isGit: boolean }
  files: Record<string, string>
  delivery: Record<string, Delivery>
  decisions: Record<string, string>
  activity: { branches: string[]; changes: string[]; commits: string[] }
}
interface RuntimeState { loading: boolean; mode: 'standalone' | 'central'; connected: boolean; plan: RuntimePlan | null; error: string | null; projects: Checkout[] }
let state: RuntimeState = { loading: true, mode: 'standalone', connected: false, plan: null, error: null, projects: [] }
let apply: ((snapshot: ContentSnapshot | null) => void) | undefined
const listeners = new Set<() => void>()
let generation = 0
let projectRequest = 0
let events: EventSource | undefined
let projectPoll: ReturnType<typeof setInterval> | undefined
const route = /^\/p\/([^/]+)(?:\/ref\/([^/]+))?/.exec(window.location.pathname)
export const runtimeBase = route?.[0] ?? '/'
export const checkoutId = route?.[1]
export const selectedRef = route?.[2] ? decodeURIComponent(route[2]) : undefined
const query = new URLSearchParams({ ...(checkoutId ? { checkoutId } : {}), ...(selectedRef ? { ref: selectedRef } : {}) }).toString()
const publish = (patch: Partial<RuntimeState>) => { state = { ...state, ...patch }; for (const listener of listeners) listener() }
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
function isRuntimeEvent(value: unknown): value is { plan: RuntimePlan | null; error: string | null } {
  if (!value || typeof value !== 'object' || !('plan' in value) || !('error' in value) ||
    (value.error !== null && typeof value.error !== 'string')) return false
  if (value.plan === null) return true
  if (!value.plan || typeof value.plan !== 'object' || !('snapshot' in value.plan) ||
    !value.plan.snapshot || typeof value.plan.snapshot !== 'object') return false
  if (!('revision' in value.plan) || typeof value.plan.revision !== 'string' ||
    !('context' in value.plan) || !value.plan.context || typeof value.plan.context !== 'object' ||
    !('token' in value.plan.context) || typeof value.plan.context.token !== 'string' ||
    !('manifest' in value.plan) || !value.plan.manifest || typeof value.plan.manifest !== 'object' ||
    !('name' in value.plan.manifest) || typeof value.plan.manifest.name !== 'string') return false
  return ['workspaces', 'products', 'components', 'features'].every(key =>
    Array.isArray((value.plan as { snapshot: Record<string, unknown> }).snapshot[key]))
}
export const useRuntime = () => useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback) } }, () => state)
export const getRuntime = () => state
export function attachSnapshot(fn: (snapshot: ContentSnapshot | null) => void) { apply = fn }
export async function refreshProjects() {
  const current = generation
  const request = ++projectRequest
  try {
    const response = await fetch('/api/projects')
    if (!response.ok) throw new Error('Could not load registered projects')
    const projects: unknown = await response.json()
    if (!Array.isArray(projects)) throw new Error('Invalid registered projects response')
    if (current === generation && request === projectRequest) publish({ projects, ...(!checkoutId ? { error: null } : {}) })
  } catch (error) {
    if (current === generation && request === projectRequest) throw error
  }
}
export async function startRuntime() {
  const current = ++generation
  events?.close()
  events = undefined
  if (projectPoll !== undefined) clearInterval(projectPoll)
  projectPoll = undefined
  publish({ loading: true })
  try {
    const response = await fetch('/api/session')
    if (current !== generation) return
    if (!response.ok) throw new Error('Groundwork service is unavailable')
    const session = await response.json()
    if (current !== generation) return
    if (session.mode !== 'central' && session.mode !== 'standalone') throw new Error('Invalid Groundwork service response')
    publish({ mode: session.mode, connected: true })
    if (session.mode === 'central') {
      try { await refreshProjects() }
      catch (error) { if (current === generation) publish({ error: message(error) }) }
    }
    if (current !== generation) return
    if (session.mode === 'central' && !checkoutId) {
      publish({ loading: false })
      projectPoll = setInterval(() => { if (current !== generation) return; void refreshProjects().catch(error => {
        if (current === generation) publish({ error: message(error) })
      }) }, 3000)
      return
    }
    events = new EventSource(`/api/events?${query}`)
    events.onmessage = event => {
      if (current !== generation) return
      try {
        const data: unknown = JSON.parse(event.data)
        if (!isRuntimeEvent(data)) throw new Error('Invalid Groundwork event response')
        const { plan, error } = data
        apply?.(plan?.snapshot ?? null)
        publish({ plan, error, loading: false, connected: true })
      } catch (error) {
        publish({ loading: false, error: message(error) })
      }
    }
    events.onerror = () => {
      if (current === generation) publish({ loading: false, connected: false, error: 'Connection lost. Showing the last received plan; reconnecting…' })
    }
  } catch (error) {
    if (current === generation) publish({ loading: false, connected: false, error: message(error) })
  }
}
