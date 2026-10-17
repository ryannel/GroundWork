// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { modelOf } from '@/../test/plan-kit';
import {
  bySeverity,
  fit,
  recordClaim,
  recordTeams,
} from '@/application/plan-story-changes-records';

const draft = modelOf(sameDay());
const notes = modelOf(orderNotes());

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
    expect(recordClaim(draft, 'sch:order')).toBe(
      'Removing `total_cents` breaks Shop BFF, Order desk and one more, and no change in this plan moves them',
    );
  });

  it('says a new required field breaks a reader nobody moves', () => {
    expect(recordClaim(notes, 'sch:search-doc')).toBe(
      'SearchDoc gains required `note`, which breaks Search indexer; no change in this plan moves it',
    );
  });

  it('says who must move first, by name', () => {
    expect(recordClaim(draft, 'sch:search-doc')).toBe(
      'SearchDoc gains required `same_day`; Search indexer must move first',
    );
  });

  it('says when no service reader is recorded', () => {
    expect(recordClaim(notes, 'sch:product-changed-v1')).toBe(
      'product.changed v1’s `sku` becomes uuid; no service reader is recorded',
    );
  });

  it('reads a safe record as what it gains or loses', () => {
    expect(recordClaim(notes, 'sch:order')).toBe(
      'Order gains a `note` field; `total_cents` is deprecated · still works',
    );
    expect(recordClaim(draft, 'sch:product')).toBe('Product gains two new fields');
    expect(recordClaim(draft, 'sch:order-placed-v1')).toBe('order.placed v1 gains a `slot` field');
    expect(recordClaim(notes, 'sch:product')).toBe('Product `sku` changes, `name` changes');
    expect(recordClaim(notes, 'sch:order-placed-v1')).toBe('order.placed v1 changes');
  });
});

describe('records in order', () => {
  it('names the store owner first, then the teams that touch it', () => {
    expect(recordTeams(draft, 'sch:order')).toEqual(['team:orders']);
    expect(recordTeams(notes, 'sch:product')).toEqual(['team:catalogue', 'team:orders']);
  });

  it('puts the record that breaks someone first and keeps ties in order', () => {
    expect(
      bySeverity(draft, ['sch:product', 'sch:search-doc', 'sch:order', 'sch:order-placed-v1']),
    ).toEqual(['sch:order', 'sch:search-doc', 'sch:product', 'sch:order-placed-v1']);
  });
});
