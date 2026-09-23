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
let apply: ((snapshot: ContentSnapshot) => void) | undefined
const listeners = new Set<() => void>()
const route = /^\/p\/([^/]+)(?:\/ref\/([^/]+))?/.exec(window.location.pathname)
export const runtimeBase = route?.[0] ?? '/'
export const checkoutId = route?.[1]
export const selectedRef = route?.[2] ? decodeURIComponent(route[2]) : undefined
const query = new URLSearchParams({ ...(checkoutId ? { checkoutId } : {}), ...(selectedRef ? { ref: selectedRef } : {}) }).toString()
const publish = (patch: Partial<RuntimeState>) => { state = { ...state, ...patch }; for (const listener of listeners) listener() }
export const useRuntime = () => useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback) } }, () => state)
export const getRuntime = () => state
export function attachSnapshot(fn: (snapshot: ContentSnapshot) => void) { apply = fn }
export async function refreshProjects() {
  const response = await fetch('/api/projects')
  if (!response.ok) throw new Error('Could not load registered projects')
  publish({ projects: await response.json(), error: null })
}
export async function startRuntime() {
  try {
    const response = await fetch('/api/session')
    if (!response.ok) throw new Error('Groundwork service is unavailable')
    const session = await response.json()
    if (session.mode !== 'central' && session.mode !== 'standalone') throw new Error('Invalid Groundwork service response')
    publish({ mode: session.mode, connected: true })
    if (session.mode === 'central') await refreshProjects()
    if (session.mode === 'central' && !checkoutId) {
      publish({ loading: false })
      setInterval(() => { void refreshProjects().catch(error => publish({ error: error.message })) }, 3000)
      return
    }
    const events = new EventSource(`/api/events?${query}`)
    events.onmessage = event => {
      const data = JSON.parse(event.data) as { plan: RuntimePlan | null; error: string | null }
      if (data.plan) apply?.(data.plan.snapshot)
      publish({ ...data, loading: false, connected: true })
    }
    events.onerror = () => publish({ loading: false, connected: false, error: 'Connection lost. Showing the last received plan; reconnecting…' })
  } catch (error) {
    publish({ loading: false, connected: false, error: (error as Error).message })
  }
}
