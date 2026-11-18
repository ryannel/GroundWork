import { describe, expect, it } from 'vitest';

import type { AreaIntegration } from '@/application/workspace-landscape-areas';

import { landscapeConnectionsInScope } from './landscape-calls';

function call(id: string, endpoint: string, callerEndpoint?: string): AreaIntegration {
  return {
    id,
    kind: 'call',
    callerArea: 'buy',
    providerArea: 'buy',
    callerSystem: 'checkout',
    providerSystem: 'cart',
    caller: 'svc:checkout',
    ...(callerEndpoint === undefined ? {} : { callerEndpoint }),
    provider: 'svc:cart',
    endpoint,
    signature: '',
    detail: '',
  };
}

describe('connections in an endpoint scope', () => {
  const records = [
    call('a', 'api:cart-checkout', 'api:checkout-submit'),
    call('b', 'api:cart-get'),
  ];
  const cart = { area: 'buy', system: 'cart', component: 'svc:cart' };

  it('keeps only the calls an endpoint serves or makes', () => {
    const ids = (endpoints: readonly string[], scope = cart) =>
      landscapeConnectionsInScope(records, [{ ...scope, endpoints }]).map(({ id }) => id);
    expect(ids(['api:cart-checkout'])).toEqual(['a']);
    expect(ids(['api:cart-checkout', 'api:cart-get'])).toEqual(['a', 'b']);
    expect(
      ids(['api:checkout-submit'], { area: 'buy', system: 'checkout', component: 'svc:checkout' }),
    ).toEqual(['a']);
    expect(landscapeConnectionsInScope(records, [cart])).toHaveLength(2);
  });
});
