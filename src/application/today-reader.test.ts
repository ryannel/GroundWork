import { describe, expect, it } from 'vitest';

import { depthIn, todayReaderOf } from './today-reader';

describe('depthIn', () => {
  it('counts the levels below the workspace, so a domain and its map find the same model.json', () => {
    expect(depthIn('w', '/w/')).toBe(0);
    expect(depthIn('w', '/w/sales/')).toBe(1);
    expect(depthIn('w', '/w/sales/map/')).toBe(2);
    expect(depthIn('w', '/base/w/sales/billing/flows/f/')).toBe(4);
    expect(todayReaderOf('w', depthIn('w', '/w/sales/map/')).modelSrc).toBe('../../model.json');
  });
});
