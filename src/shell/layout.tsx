import { Suspense, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { ErrorBoundary } from '@/components/error-boundary'
import { checkoutId, useRuntime } from '@/data/runtime'
import { TopBar } from './top-bar'

/** Scroll offsets per history entry (location.key), recorded while scrolling so a later navigation cannot clamp them. */
const scrollPositions = new Map<string, number>()

/**
 * Directory destinations start at their heading and Back restores the list position.
 * Feature sections manage their own scroll, item focus and heading focus.
 */
function useDirectoryScroll(main: RefObject<HTMLElement | null>, feature: boolean) {
  const { pathname, key } = useLocation()
  const navigationType = useNavigationType()
  const currentKey = useRef(key)
  const previousPath = useRef<string>(undefined)
  useEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const save = () => { scrollPositions.set(currentKey.current, window.scrollY) }
    window.addEventListener('scroll', save, { passive: true })
    return () => { window.removeEventListener('scroll', save); history.scrollRestoration = previous }
  }, [])
  useLayoutEffect(() => {
    currentKey.current = key
    // Filter changes replace the entry on the same path; they keep the reader's place.
    if (previousPath.current === pathname) return
    const initial = previousPath.current === undefined
    previousPath.current = pathname
    if (initial || feature) return
    window.scrollTo({ top: navigationType === 'POP' ? scrollPositions.get(key) ?? 0 : 0 })
    main.current?.focus({ preventScroll: true })
  }, [key, pathname, feature, navigationType, main])
}

export function Layout() {
  const { pathname } = useLocation()
  const feature = pathname.startsWith('/f/')
  const main = useRef<HTMLElement>(null)
  useDirectoryScroll(main, feature)
  const runtime = useRuntime()
  const hub = runtime.mode === 'central' && !checkoutId
  return (
    <div className={feature ? 'workbench-shell' : 'workbench-shell directory-shell'} data-density={feature ? 'workbench' : undefined}>
      <div className="ambient" aria-hidden />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopBar />
      {runtime.error && !hub && <aside className="runtime-error" role="alert">
        <strong>{runtime.plan ? 'Showing the last valid plan' : 'This repository needs attention'}</strong>
        <pre>{runtime.error}</pre>
        {!runtime.plan && <p>In the app folder, run <code>npx --no-install groundwork-v2 init</code> to set up planning.</p>}
      </aside>}
      <main ref={main} id="main-content" tabIndex={-1} className={feature ? 'workbench-content' : 'directory-content'}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<p role="status" className="p-8 text-fg-muted">Loading view…</p>}><Outlet /></Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
