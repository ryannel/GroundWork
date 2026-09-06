import type { Component, Feature } from './model'

/** Product scope includes owned work and changes entering the product from elsewhere. */
export function featureInProduct(feature: Feature, productId: string, components: Component[]): boolean {
  return productId === 'all' || feature.productId === productId || feature.touches.some(id => components.some(component => component.id === id && component.productId === productId))
}

/** Only actual component references count as a cross-product connection. */
export function connectedProductIds(feature: Feature, components: Component[]): string[] {
  return [...new Set(feature.touches.map(id => components.find(component => component.id === id)?.productId).filter((id): id is string => !!id && id !== feature.productId))]
}
