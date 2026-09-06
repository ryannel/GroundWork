import type { ComponentType } from 'react'
import type { LivePrototypeId } from '@/data/live-prototypes'
import { TaxCartTotals } from './tax-cart-totals'

/** Live mockups referenced by `Mockup.ref` when kind is `live`. Add new mocks here. */
export const mocks: Record<string, ComponentType> = {
  'tax-cart-totals': TaxCartTotals,
} satisfies Record<LivePrototypeId, ComponentType>
