import { describe, expect, it } from 'vitest';

import { sourceLabel } from '@/application/plan-viz-source';

describe('sourceLabel', () => {
  it('prefers the label the plan gives', () => {
    expect(sourceLabel({ url: 'https://x.test/a', label: 'The spec' })).toBe('The spec');
  });
  it('reads a GitHub link as repo, file and lines', () => {
    expect(
      sourceLabel({ url: 'https://github.com/acme/orders/blob/main/src/api/orders.ts#L10-L20' }),
    ).toBe('orders · orders.ts#L10-20');
  });
  it('falls back to host and path, and to the text when it is no link', () => {
    expect(sourceLabel({ url: 'https://docs.test/guide/api' })).toBe('docs.test/guide/api');
    expect(sourceLabel({ url: 'not a link' })).toBe('not a link');
  });
});
