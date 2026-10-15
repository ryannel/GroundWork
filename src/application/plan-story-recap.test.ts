import { describe, expect, it } from 'vitest';

import { isFragment } from './plan-story-recap';

describe('isFragment', () => {
  it('treats a list of bare nouns as a label', () => {
    expect(isFragment('Address, order, `order.placed`, PDF.')).toBe(true);
  });

  it('keeps a sentence', () => {
    expect(isFragment('Promise down means no date, never an error.')).toBe(false);
  });
});
