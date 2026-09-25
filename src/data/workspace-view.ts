import { componentMembership } from '../../shared/content.ts'
import type { Component, Feature, Product } from '../../shared/model.ts'

/** Product scope includes owned work and changes entering the product from elsewhere. */
export function featureInProduct(feature: Feature, productId: string, components: Component[], products: Product[]): boolean {
  return productId === 'all' || feature.productId === productId
    || feature.touches.some(id => components.some(component => component.id === id
      && componentMembership(component, products).productIds.includes(productId)))
}

/** Only actual component references count as a cross-product connection. */
export function connectedProductIds(feature: Feature, components: Component[], products: Product[]): string[] {
  const productIds = feature.touches.flatMap(id => {
    const component = components.find(candidate => candidate.id === id)
    return component ? componentMembership(component, products).productIds : []
  })
  return [...new Set(productIds.filter(id => id !== feature.productId))]
}
