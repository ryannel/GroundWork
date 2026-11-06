import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { derive } from './derive';
import { placementDataOf } from './derive-placement';

describe('transitional legacy placement', () => {
  it('carries only declared root containment across JSON and lets children follow their parent', () => {
    const { today } = acme();
    const data = placementDataOf(today.model.asIs, today.model.place);
    expect(data['st:product-events']).toEqual({
      domain: 'catalogue',
      system: 'sys:products',
      component: 'st:product-events',
    });
    expect(data).not.toHaveProperty('sch:product#sku');
    expect(data['sch:product']).toMatchObject({
      system: 'sys:products',
      component: 'st:products-db',
    });
    const browser = derive(today.plan, { placements: data });
    expect(browser.place('sch:product#sku')).toMatchObject({
      system: 'sys:products',
      component: 'st:products-db',
    });
    expect(browser.place('flow:place-order#create')).toMatchObject({
      system: 'sys:ordering',
      component: 'svc:order-api',
    });
    expect(browser.place('msg:product-changed')).toMatchObject({
      system: 'sys:products',
      component: 'st:product-events',
    });
    expect(browser.place('api:products-get')).toMatchObject({
      system: 'sys:products',
      component: 'svc:products',
    });
    expect(browser.ownerService('st:product-events')).toBeNull();
  });
  it('never substitutes ownership for missing placement and still uses a service’s explicit system', () => {
    const { today } = acme();
    const model = derive(today.plan);
    expect(model.ownerService('st:orders-db')).toBe('svc:order-api');
    expect(model.place('st:orders-db')).toBeNull();
    expect(model.place('svc:order-api')).toEqual({
      domain: null,
      system: 'sys:ordering',
      component: 'svc:order-api',
    });
    expect(model.place('absent')).toBeNull();
    expect(placementDataOf(model.asIs, model.place)).not.toHaveProperty('st:orders-db');
  });
});
