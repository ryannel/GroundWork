import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { modelOf } from '@/../test/plan-kit';
import { operationDocumentOf } from '@/application/plan-pages-entity-extras';
import { sigOf } from '@/application/plan-viz-flow-size';
import { callWords, protocolOf } from '@/application/plan-viz-protocol';

const model = modelOf(shop());

describe('protocolOf', () => {
  it('names a GraphQL operation and a REST endpoint by how they travel', () => {
    expect(protocolOf(model, 'gql:product-page')).toBe('GraphQL');
    expect(protocolOf(model, 'api:pricing-price')).toBe('REST');
  });

  it('says nothing of an event or an unknown id', () => {
    expect(protocolOf(model, 'msg:price-published')).toBeNull();
    expect(protocolOf(model, 'api:nowhere')).toBeNull();
  });
});

describe('callWords', () => {
  it('says query or mutation for an operation, and call for an endpoint', () => {
    expect(callWords(model, 'gql:product-page')).toBe('GraphQL query');
    expect(callWords(model, 'gql:add-to-cart')).toBe('GraphQL mutation');
    expect(callWords(model, 'api:pricing-price')).toBe('REST call');
    expect(callWords(model, 'msg:price-published')).toBeNull();
  });
});

describe('an operation on a card and in the inspector', () => {
  it('reads as its kind and name on its row', () => {
    expect(sigOf(model, 'gql:add-to-cart')).toBe('mutation AddToCart');
  });

  it('carries its query to show and copy', () => {
    expect(operationDocumentOf(model, 'gql:add-to-cart', true)).toEqual({
      mode: 'asIs',
      text: 'mutation AddToCart($sku: ID!) { addToCart(sku: $sku, qty: 1) { id lines { qty } } }',
    });
    expect(operationDocumentOf(model, 'api:pricing-price', true)).toBeNull();
  });
});
