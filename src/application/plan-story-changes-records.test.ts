// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  bySeverity,
  fit,
  recordClaim,
  recordTeams,
} from '@/application/plan-story-changes-records';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no ${plan}`);
  return data.model;
}

const promise = await modelOf('delivery-promise');
const reservation = await modelOf('stock-reservation');
const graph = await modelOf('storefront-graph');
const vat = await modelOf('invoice-vat-number');

describe('fitting a headline', () => {
  it('keeps a short headline whole', () => {
    expect(fit('Short and true')).toEqual({ head: 'Short and true', rest: '' });
  });

  it('splits a long headline at the last break and capitalises the rest', () => {
    const text =
      'Removing the old field breaks the storefront today; the team has to move it before M4 ends';
    expect(fit(text)).toEqual({
      head: 'Removing the old field breaks the storefront today',
      rest: 'The team has to move it before M4 ends',
    });
  });

  it('drops the closing bracket of a bracketed tail', () => {
    expect(fit('A headline long enough to need splitting (because it says a lot)', 50)).toEqual({
      head: 'A headline long enough to need splitting',
      rest: 'Because it says a lot',
    });
  });

  it('keeps a long headline whole when no break falls late enough', () => {
    const text = 'a'.repeat(100);
    expect(fit(text)).toEqual({ head: text, rest: '' });
    expect(fit('Early, then a very long unbroken tail of words without breaks', 30).rest).toBe('');
  });
});

describe('what a record costs', () => {
  it('says which unmoved readers a removal breaks', () => {
    expect(recordClaim(promise, 'sch:product')).toBe(
      'Removing `lead_time_text` breaks Storefront BFF, and no change in this plan moves it',
    );
    expect(recordClaim(graph, 'sch:gql-cart')).toBe(
      'Removing `estimatedDelivery` breaks AddToCart and CartSummary, and no change in this plan moves them',
    );
  });

  it('says a new required field breaks a reader nobody moves', () => {
    expect(recordClaim(promise, 'sch:checkout-session')).toBe(
      'CheckoutSession gains required `promised_date`, which breaks Cart; no change in this plan moves it',
    );
  });

  it('says who must move first, by name or by role', () => {
    expect(recordClaim(promise, 'sch:price')).toBe(
      'Price gains required `shipping_component_cents`; Pricing must move first',
    );
    expect(recordClaim(reservation, 'sch:stock-level')).toBe(
      'StockLevel gains required `reserved`; Allocation worker and WMS must move first',
    );
    expect(recordClaim(promise, 'sch:order-placed-v1')).toBe(
      'order.placed v1 loses `order_id`; four consumers must move first',
    );
  });

  it('says when no service reader is recorded', () => {
    expect(recordClaim(promise, 'sch:search-document')).toBe(
      'SearchDocument loses `lead_time_text`; no service reader is recorded',
    );
    expect(recordClaim(vat, 'sch:invoice')).toBe(
      'Invoice’s `bill_to` becomes BillingIdentity; no service reader is recorded',
    );
  });

  it('reads a safe record as what it gains or loses', () => {
    expect(recordClaim(vat, 'sch:checkout-session')).toBe(
      'CheckoutSession gains a `billing` field',
    );
    expect(recordClaim(promise, 'sch:cart')).toBe('Cart gains two new fields');
    expect(recordClaim(reservation, 'sch:order')).toBe(
      'Order `cancel_reason` is deprecated · still works',
    );
    expect(recordClaim(graph, 'sch:gql-money')).toBe('Money `amount` changes, `currency` changes');
    expect(recordClaim(promise, 'sch:payment')).toBe('Payment changes');
  });
});

describe('records in order', () => {
  it('names the store owner first, then the teams that touch it', () => {
    expect(recordTeams(promise, 'sch:price')).toEqual(['team:pricing']);
    expect(recordTeams(promise, 'sch:order')).toEqual([
      'team:orders',
      'team:notifications',
      'team:fulfilment',
    ]);
  });

  it('puts the record that breaks someone first and keeps ties in order', () => {
    expect(bySeverity(promise, ['sch:payment', 'sch:shipment', 'sch:product'])).toEqual([
      'sch:product',
      'sch:payment',
      'sch:shipment',
    ]);
  });
});
