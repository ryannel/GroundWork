import { Suspense, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { useTheme } from '@/lib/theme-context'
import { TopBar } from './top-bar'
import { useRuntime } from '@/data/runtime'
import { RepositoryBar } from './repository-bar'

export function Layout() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const feature = pathname.startsWith('/f/')
  const positions = useRef(new Map<string, number>())
  const previousPath = useRef<string>(undefined)
  const main = useRef<HTMLElement>(null)
  // Directory destinations start at their heading; Back restores the list position.
  // Feature sections manage their own item and diagram focus.
  useLayoutEffect(() => {
    if (!feature && previousPath.current !== pathname) {
      window.scrollTo({ top: navigationType === 'POP' ? positions.current.get(pathname) ?? 0 : 0 })
      main.current?.focus({ preventScroll: true })
    }
    previousPath.current = pathname
    const saved = positions.current
    return () => { saved.set(pathname, window.scrollY) }
  }, [pathname, feature, navigationType])
  const { resolved } = useTheme()
  const runtime = useRuntime()
  return (
    <div className={feature ? "workbench-shell" : "workbench-shell directory-shell"} data-workbench-theme={resolved}>
      <div className="ambient" aria-hidden />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopBar />
      <RepositoryBar />
      {runtime.error && <aside className="runtime-error" role="alert"><strong>{runtime.plan ? 'Showing the last valid plan' : 'This repository needs attention'}</strong><pre>{runtime.error}</pre>{!runtime.plan && <p>In the app folder, run <code>npx --no-install groundwork-v2 init</code> to set up planning.</p>}</aside>}
      <main ref={main} id="main-content" tabIndex={-1} className={feature ? "workbench-content" : "directory-content"}>
        <Suspense fallback={<p role="status" className="p-8 text-fg-muted">Loading view…</p>}><Outlet /></Suspense>
      </main>
    </div>
  )
}
