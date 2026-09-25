import { componentMembership } from '../../shared/content.ts'
import { componentAncestors } from '../../shared/component-structure.ts'
import type { Component, Feature, Product, Workspace } from '../../shared/model.ts'

export interface SearchDestination { id: string; title: string; context: string; href: string }

/** Search navigable identities, preserving the workspace and product that own each result. */
export function navigationSearch(query: string, data: {
  products: Product[]; workspaces: Workspace[]; components: Component[]; features: Feature[]
}): SearchDestination[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  const productPath = (product: Product) => {
    const workspace = data.workspaces.find(item => item.id === product.workspaceId)
    return workspace ? `/w/${workspace.slug}/${product.slug}` : undefined
  }
  const results: SearchDestination[] = []
  for (const product of data.products) {
    const href = productPath(product)
    if (href) results.push({ id: `product:${product.id}`, title: product.name, context: 'Product', href })
  }
  for (const component of data.components) {
    const product = data.products.find(item => item.id === componentMembership(component, data.products).ownedBy)
    const href = product && productPath(product)
    if (href) results.push({ id: `component:${component.id}`, title: component.name, context: `Component · ${product!.name}`,
      href: `${href}?component=${encodeURIComponent(componentAncestors(component.id, data.components)[0]?.id ?? component.id)}#component-details` })
  }
  for (const feature of data.features) results.push({ id: `feature:${feature.id}`, title: feature.title,
    context: `Feature · ${data.products.find(item => item.id === feature.productId)?.name ?? 'Plan'}`, href: `/f/${feature.id}` })
  return results.filter(item => `${item.title} ${item.context}`.toLocaleLowerCase().includes(term))
    .sort((a, b) => Number(b.title.toLocaleLowerCase().startsWith(term)) - Number(a.title.toLocaleLowerCase().startsWith(term)))
}
