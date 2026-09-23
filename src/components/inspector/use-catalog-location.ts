import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Component } from '@/data/model'
import { catalogHistory, readCatalogLocation, writeCatalogLocation, type CatalogHistory, type CatalogLocation } from '@/data/catalog-url'

export type NavigateCatalog = (patch: CatalogLocation, history?: CatalogHistory) => void

/**
 * The URL is the single source of truth for catalog selection. One call writes one patch, because react-router
 * resolves functional updates against the rendered params and a second call in the same event would drop the first.
 */
export function useCatalogLocation(): [CatalogLocation, NavigateCatalog] {
  const [params, setParams] = useSearchParams()
  const location = useMemo(() => readCatalogLocation(params), [params])
  const navigate = useCallback<NavigateCatalog>((patch, history = catalogHistory(patch)) => {
    setParams(previous => writeCatalogLocation(previous, patch), { replace: history === 'replace', preventScrollReset: true })
  }, [setParams])
  return [location, navigate]
}

/** What every inspector tab panel receives from the shell. */
export type CatalogPanelProps = {
  component: Component
  dependencies: Component[]
  location: CatalogLocation
  navigate: NavigateCatalog
  onSelectComponent?: (id: string) => void
}
