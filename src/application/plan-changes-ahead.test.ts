import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { derive } from '@/application/plan/derive';
import { aheadStop } from '@/application/plan-changes-ahead';

const model = derive(shop());
const at = { workspace: 'acme', slug: 'shop' };

describe('where a pinned thing changes', () => {
  it('finds the screen of chapter 4 that draws it, and its place in the story', () => {
    expect(aheadStop(model, at, 'sch:gql-product')).toEqual({
      href: '/acme/plans/shop/changes/contracts/',
      title: 'Interfaces that get a new version',
      position: '4.2',
    });
  });

  it('finds a field by its exact id, and one the screen holds only by its parent', () => {
    expect(aheadStop(model, at, 'sch:gql-money#amount')?.position).toBe('4.2');
    expect(aheadStop(model, at, 'sch:gql-product#title')?.position).toBe('4.2');
  });

  it('falls back to the ledger of all changes', () => {
    expect(aheadStop(model, at, 'gql:product-page')).toEqual({
      href: '/acme/plans/shop/changes/ledger/',
      title: 'All changes',
      position: '4.3',
    });
  });
});
