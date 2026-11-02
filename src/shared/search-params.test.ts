import { describe, expect, it } from 'vitest';

import { firstParam, paramOrNull } from './search-params';

describe('search params', () => {
  it('takes the first value of a name, or nothing', () => {
    expect(firstParam('a')).toBe('a');
    expect(firstParam(['b', 'c'])).toBe('b');
    expect(firstParam([])).toBe('');
    expect(paramOrNull('')).toBeNull();
    expect(paramOrNull(['team'])).toBe('team');
  });
});
