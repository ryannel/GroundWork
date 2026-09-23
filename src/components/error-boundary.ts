/*
 * Plain `.ts` with createElement (no JSX) so node:test can load it without a JSX transform.
 */
import { Component, createElement, type ErrorInfo, type ReactNode } from 'react'

const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** A lazy route whose hashed chunk no longer exists, usually because the viewer was rebuilt while this tab stayed open. */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'ChunkLoadError' || CHUNK_LOAD_ERROR.test(error.message))
}

const RELOAD_KEY = 'gw-chunk-reload'
const RELOAD_WINDOW_MS = 60_000
type ReloadStore = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Whether to reload the page for this error. Only chunk-load errors qualify, and only once a minute,
 * so a chunk that is genuinely missing shows the fallback instead of reloading forever.
 */
export function shouldReloadForChunk(error: unknown, store: ReloadStore | undefined, now: number): boolean {
  if (!isChunkLoadError(error) || !store) return false
  try {
    if (now - Number(store.getItem(RELOAD_KEY) ?? 0) < RELOAD_WINDOW_MS) return false
    store.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

const sessionStore = (): ReloadStore | undefined => {
  try { return window.sessionStorage } catch { return undefined }
}
const reloadPage = () => window.location.reload()

export interface ErrorBoundaryProps {
  children?: ReactNode
  /** A change clears the error, e.g. the pathname for a route-level boundary. */
  resetKey?: unknown
  /** Injected in tests. */
  reload?: () => void
}
interface ErrorBoundaryState { error: unknown; resetKey: unknown }

/** Shows a recoverable message instead of a blank page when rendering fails or a lazy chunk cannot load. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: undefined, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error ?? new Error('Unknown error') }
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return Object.is(props.resetKey, state.resetKey) ? null : { error: undefined, resetKey: props.resetKey }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
    if (shouldReloadForChunk(error, sessionStore(), Date.now())) (this.props.reload ?? reloadPage)()
  }

  render() {
    const { error } = this.state
    if (error === undefined) return this.props.children ?? null
    const chunk = isChunkLoadError(error)
    return createElement('div', { className: 'runtime-start', role: 'alert' },
      createElement('h1', null, chunk ? 'Groundwork was updated' : 'This view could not be shown'),
      createElement('p', null, chunk
        ? 'This tab is running an older version of the viewer. Reload to continue.'
        : error instanceof Error ? error.message : String(error)),
      createElement('button', { type: 'button', onClick: this.props.reload ?? reloadPage }, 'Reload'),
    )
  }
}
