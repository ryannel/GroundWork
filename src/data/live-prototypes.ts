/** Native interactive renderers are code plugins; ordinary content never needs registration. */
export const livePrototypeIds = ['tax-cart-totals'] as const
export type LivePrototypeId = typeof livePrototypeIds[number]
