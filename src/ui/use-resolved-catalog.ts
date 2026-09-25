import { useEffect, useState } from 'react'
import type { Component } from '../data/model.ts'
import { useRuntime } from '../data/runtime.ts'

export interface CatalogRepositoryView {
  repository: string
  source: { label: string } | null
  local: { label: string }
  components: Component[]
  resolution: {
    areas: { unit: { componentId: string; area: string }; provenance: CatalogProvenance }[]
    flows: { unit: { componentId: string; id: string }; provenance: CatalogProvenance }[]
    findings: { unit: { componentId: string; id: string }; provenance: CatalogProvenance }[]
    retirements: { unit: { componentId: string; id: string }; provenance: CatalogProvenance; effective: boolean }[]
    warnings: { componentId: string; kind: string; id: string; status: 'diverged' | 'unknown' }[]
  }
  incompatible: { unit: { componentId: string; kind: string; id: string };
    incompatible: { kind: string; id: string; areaRevision: string | null }[] }[]
}

interface CatalogProvenance {
  catalog: 'source' | 'local'
  revision: string | null
  otherRevision?: string | null
  conflict?: 'diverged' | 'unknown'
  reason: string
}

export function useResolvedCatalog(productId: string) {
  const { plan } = useRuntime()
  const checkoutId = plan?.context.checkoutId
  const ref = plan?.context.ref
  const revision = plan?.revision
  const [result, setResult] = useState<{ key: string; value: { productId: string; homeRepository: string; repositories: CatalogRepositoryView[] } } | null>(null)
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const key = JSON.stringify([checkoutId, ref, productId, revision])
  useEffect(() => {
    if (!checkoutId || !productId) return
    const query = new URLSearchParams({ checkoutId, productId, ...(ref ? { ref } : {}) })
    let controller: AbortController | null = null
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      const active = controller
      void fetch(`/api/product-catalog?${query}`, { signal: active.signal }).then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? 'Could not resolve product catalogs')
        setResult({ key, value: body })
        setError(null)
      }).catch(reason => {
        if (active.signal.aborted) return
        setError({ key, message: reason instanceof Error ? reason.message : String(reason) })
      })
    }
    refresh()
    const interval = window.setInterval(refresh, 15000)
    return () => { window.clearInterval(interval); controller?.abort() }
  }, [checkoutId, productId, ref, key])
  return { result: result?.key === key ? result.value : null, error: error?.key === key ? error.message : null }
}
