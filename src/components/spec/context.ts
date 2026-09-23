import { createContext, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FeatureSpec, SectionKind } from '@/data/spec'
import type { Lens, Ref, SpecIndex } from '@/data/spec-index'

/** Everything a section needs to cross-reference: the feature id (for URLs), the spec and its index. */
export interface SpecCtx { featureId: string; spec: FeatureSpec; ix: SpecIndex; /** Component lens: when set, sections show only what touches it. */ lens?: Lens; lensName?: string }
export const SpecContext = createContext<SpecCtx | null>(null)
export const useSpec = () => {
  const c = useContext(SpecContext)
  if (!c) throw new Error('useSpec outside SpecContext')
  return c
}

/** The ids a section should show under the current lens, or undefined for everything. */
export function useLens(kind: SectionKind): Set<string> | undefined {
  return useSpec().lens?.[kind]
}
export const refHref = (featureId: string, r: Ref) => `/f/${featureId}/${r.kind}/${r.id}`

/** Smooth scrolling unless the user asked for reduced motion. */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/**
 * Focus: the item named in the URL. Scrolls it into view once and flashes a ring.
 * Returns the ref. The highlight class is derived from the selected ID by the caller.
 */
export function useFocus<T extends HTMLElement = HTMLDivElement>(id: string, focus?: string) {
  const el = useRef<T>(null)
  const on = focus === id
  useEffect(() => {
    if (on && el.current) el.current.scrollIntoView({ block: 'center', behavior: scrollBehavior() })
  }, [on])
  return el
}

/** Click handler that navigates to a ref. For SVG or non-anchor targets. */
export function useGoTo() {
  const { featureId } = useSpec()
  const nav = useNavigate()
  return (r: Ref) => nav(refHref(featureId, r))
}
