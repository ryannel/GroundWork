import { useEffect, useState } from 'react'
import type { Component } from '../../shared/model.ts'
import { useRuntime } from '../data/runtime.ts'

export interface CatalogRepositoryView {
  repository: string
  selected: 'source' | 'local'
  source: { label: string } | null
  local: { label: string } | null
  components: Component[]
}
export interface ProductCatalogView {
  productId: string
  homeRepository: string
  repositories: CatalogRepositoryView[]
}

/** Read only the source or local catalog selected by the product for each repository. */
export function useProductCatalog(productId: string) {
  const { plan } = useRuntime()
  const checkoutId = plan?.context.checkoutId
  const ref = plan?.context.ref
  const revision = plan?.revision
  const [result, setResult] = useState<{ key: string; value: ProductCatalogView } | null>(null)
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const key = JSON.stringify([checkoutId, ref, productId, revision])
  useEffect(() => {
    if (!checkoutId || !productId) return
    const query = new URLSearchParams({ checkoutId, productId, ...(ref ? { ref } : {}) })
    const controller = new AbortController()
    void fetch(`/api/product-catalog?${query}`, { signal: controller.signal }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not read product catalog')
      setResult({ key, value: body })
      setError(null)
    }).catch(reason => {
      if (controller.signal.aborted) return
      setError({ key, message: reason instanceof Error ? reason.message : String(reason) })
    })
    return () => controller.abort()
  }, [checkoutId, productId, ref, key])
  return { result: result?.key === key ? result.value : null, error: error?.key === key ? error.message : null }
}
