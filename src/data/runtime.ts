import { useSyncExternalStore } from 'react'
import type { ContentSnapshot } from './content'
import type { Delivery } from './delivery'
export interface Checkout { checkoutId: string; root: string; projectId: string; name: string; workspace: string; branch: string | null; head: string | null; isGit?: boolean; features: { id: string; title: string; stage: string }[]; error: string | null }
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
interface RuntimeState { loading: boolean; mode: 'demo' | 'standalone' | 'central'; connected: boolean; plan: RuntimePlan | null; error: string | null; projects: Checkout[] }
let state: RuntimeState = { loading: true, mode: 'standalone', connected: false, plan: null, error: null, projects: [] }
let token = ''
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
  publish({ projects: await response.json() })
}
export async function startRuntime() {
  try {
    const response = await fetch('/api/session')
    if (!response.ok) throw new Error('Groundwork service is unavailable')
    const session = await response.json()
    token = session.token
    publish({ mode: session.mode, connected: true })
    await refreshProjects()
    if (session.mode === 'central' && !checkoutId) { publish({ loading: false }); setInterval(() => { void refreshProjects().catch(error => publish({ error: error.message })) }, 3000); return }
    const events = new EventSource(`/api/events?${query}`)
    events.onmessage = event => {
      const data = JSON.parse(event.data) as { plan: RuntimePlan | null; error: string | null }
      if (data.plan) apply?.(data.plan.snapshot)
      publish({ ...data, loading: false, connected: true })
    }
    events.onerror = () => publish({ loading: false, connected: false, error: 'Connection lost. Showing the last received plan; reconnecting…' })
  } catch (error) {
    if (import.meta.env.DEV) {
      const { loadContent } = await import('./content')
      const { livePrototypeIds } = await import('./live-prototypes')
      const files = import.meta.glob('../../content/**/*.json', { eager: true, import: 'default' })
      const documents = Object.fromEntries(Object.entries(files).map(([file, value]) => [file.replace('../../content/', ''), value]))
      try { apply?.(loadContent(documents, livePrototypeIds)); publish({ loading: false, mode: 'demo', error: null }) }
      catch (error) { publish({ loading: false, mode: 'demo', error: String(error) }) }
    } else publish({ loading: false, error: (error as Error).message })
  }
}
export async function mutate(operation: string, args: Record<string, unknown>) {
  const plan = state.plan
  if (!plan || !plan.context.editable || state.error || !state.connected) throw new Error('Select a valid, connected working checkout before editing')
  const response = await fetch(`/api/operations/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...args, checkoutId: plan.context.checkoutId, expectedRevision: plan.revision, expectedContext: plan.context.token }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Write failed')
  return result
}
