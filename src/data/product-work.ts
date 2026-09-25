import type { Component, Feature, Product } from '../../shared/model.ts'
import { connectedProductIds, featureInProduct } from './workspace-view.ts'

export type WorkStatus = 'active' | 'ideas' | 'shipped'
export type WorkInvolvement = 'all' | 'owned' | 'incoming' | 'shared'

/** One collection owns all product-work filters, including work planned elsewhere. */
export function productWork(features: Feature[], components: Component[], products: Product[], productId: string, filters: {
  status: WorkStatus
  stage?: string
  involvement?: WorkInvolvement
  componentIds?: ReadonlySet<string>
  search?: string
}) {
  const relevant = features.filter(feature => featureInProduct(feature, productId, components, products))
  const search = filters.search?.trim().toLowerCase() ?? ''
  const scoped = relevant.filter(feature => {
    if (filters.componentIds && !feature.touches.some(id => filters.componentIds!.has(id))) return false
    if (search && !`${feature.title} ${feature.summary ?? ''} ${feature.owner}`.toLowerCase().includes(search)) return false
    if (filters.involvement === 'owned' && feature.productId !== productId) return false
    if (filters.involvement === 'incoming' && feature.productId === productId) return false
    if (filters.involvement === 'shared' && !connectedProductIds(feature, components, products).length) return false
    return true
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const active = scoped.filter(feature => feature.stage !== 'idea' && feature.stage !== 'shipped')
  const ideas = scoped.filter(feature => feature.stage === 'idea')
  const shipped = scoped.filter(feature => feature.stage === 'shipped')
  const rows = filters.status === 'ideas' ? ideas : filters.status === 'shipped' ? shipped
    : active.filter(feature => !filters.stage || feature.stage === filters.stage)
  return { relevant, active, rows, counts: { active: active.length, ideas: ideas.length, shipped: shipped.length } }
}
